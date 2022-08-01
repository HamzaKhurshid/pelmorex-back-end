import _ from 'lodash';

import path from 'path';
import { AWS, Storage } from './mock.js';
import VError from 'verror';
import mime from 'mime-types';
import { v1 as uuid } from 'uuid';

const TEMP_DIRECTORY = '../../../../../tmp/';
const UPLOAD_DIRECTORY = '../../../../../tmp/rich-media-markup-uploads';
const EXTRACT_DIRECTORY = '../../../../../tmp/rich-media-markup-extracted';

import {
  S3_KEY,
  S3_SECRET,
  S3_CREATIVES_BUCKET,
  S3_ACCESS_CONTROL_LIST,
  ONE_HUNDRED_MEGABYTES,
  GCS_CREATIVE_BUCKET_NAME
} from './constants/index.js';

const __dirname = '';
const s3 = new AWS.S3({
  accessKeyId: S3_KEY,
  secretAccessKey: S3_SECRET,
});
const storage = new Storage();

async function handler(req, res, next) {
  const { flags } = res.locals;
  const { id: campaignId } = res.locals.campaign;

  persistTempFolders();

  const form = new formidable.IncomingForm();
  const filesInfo = [];
  let zipFileBaseName;
  let uploadId = uuid.v4();

  form.maxFileSize = ONE_HUNDRED_MEGABYTES;
  form.keepExtensions = true;
  form.multiples = true;
  form.uploadDir = UPLOAD_DIRECTORY;

  form.on('fileBegin', function (name, file) {
    const fileBaseName = path.basename(file.name, path.extname(file.name));
    const fileExtension = path.extname(file.name);
    const filePath = path.join(
      UPLOAD_DIRECTORY,
      `${fileBaseName}_${new Date().getTime()}${fileExtension}`
    );
    const destinationDirectory = path.join(EXTRACT_DIRECTORY, fileBaseName);

    filesInfo.push({
      fileBaseName,
      fileExtension,
      filePath,
      destinationDirectory,
    });

    if (!zipFileBaseName) {
      zipFileBaseName = fileBaseName;
    }

    file.path = filePath;
  });

  try {
    const { fields, files } = await parseFilesFromForm(form, req);
    const { dimensions, exporter } = fields;

    if (_.keys(files).length === 0) {
      return next(UserError.validationError('no files uploaded'));
    }

    const validFiles = _.every(filesInfo, ['fileExtension', '.zip']);

    if (!validFiles) {
      return next(UserError.validationError('unsupported file type'));
    }

    let s3UploadResults = {};

    await extractFiles(filesInfo);

    for (const file of filesInfo) {
      const { destinationDirectory: directoryToUpload, fileBaseName } = file;

      await validateFile({ directoryToUpload, fileBaseName, type: exporter });

      s3UploadResults = await uploadDirectoryToS3({
        campaignId,
        directoryToUpload,
        fileBaseName,
        uploadId,
        exporter,
        flags,
      });

      removeTempFolders();
    }

    const rootHtmlFile = _.find(s3UploadResults, ({ Key }) => {
      return _.includes(Key, '.html');
    }).Key;
    const rootHtmlFileBaseName = _.last(rootHtmlFile.split('/')).split('.html')[0];

    const { cdnUrl, markup } = getGeneratedMarkup({
      exporter,
      zipFileBaseName,
      rootHtmlFileBaseName,
      campaignId,
      dimensions,
      uploadId,
    });

    return next({ s3UploadResults, filesInfo, cdnUrl, markup, zipFileBaseName, campaignId });
  } catch (error) {
    return next(ServerError.unknownError(error));
  }
}

const parseFilesFromForm = (form, req) => {
  return new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) {
        reject(error);
        return;
      }

      const schema = createFormFieldSchema();
      const { error: validationError } = schema.validate(fields);

      if (validationError) {
        reject(validationError);
        return;
      }

      resolve({ fields, files });
    });
  });
};

const persistTempFolders = () => {
  if (!fs.existsSync(TEMP_DIRECTORY)) {
    fs.mkdirSync(TEMP_DIRECTORY);
  }

  if (!fs.existsSync(UPLOAD_DIRECTORY)) {
    fs.mkdirSync(UPLOAD_DIRECTORY);
  }

  if (!fs.existsSync(EXTRACT_DIRECTORY)) {
    fs.mkdirSync(EXTRACT_DIRECTORY);
  }
};

const extractFiles = async filesInfo => {
  for (const file of filesInfo) {
    const { filePath, destinationDirectory } = file;
    try {
      await new Promise((resolve, reject) => {
        extract(filePath, { dir: `${destinationDirectory}` }, error => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      throw new VError(error, `failed to extract ${filePath}`);
    }
  }
};

const validateFile = async ({ fileBaseName, directoryToUpload, type }) => {
  await validateZipFile({ fileBaseName, directoryToUpload, type });
};

export const validateZipFile = async ({
  type = 'gwd',
  fileBaseName,
  directoryToUpload,
  _getFiles = getFiles,
  _readRootHtmlFile = readRootHtmlFile
} = {}) => {
  const files = await _getFiles(path.resolve(__dirname, directoryToUpload));
  const rootHtmlFile = _.find(files, file => _.includes(file, '.html'));

  if (!rootHtmlFile) {
    throw new VError('Zip file does not contain a root .html file');
  }

  if (type === 'conversion') {
    const rootHtmlFileBaseName = _(rootHtmlFile)
      .replace(`${EXTRACT_DIRECTORY}/${fileBaseName}/`, '')
      .split('.html')[0]
      .split('/')[0];

    if (!_.includes(fileBaseName, rootHtmlFileBaseName)) {
      throw new VError(`Zip file name '${fileBaseName}' does not contain basename '${rootHtmlFileBaseName}'`);
    }
  }

  const rootHtmlString = _readRootHtmlFile(rootHtmlFile);

  if (rootHtmlString.length < 1) {
    throw new VError('Root .html file is missing content');
  }

  if (type === 'gwd') {
    const containsGWDMeta = _.includes(
      rootHtmlString,
      'name="generator" content="Google Web Designer'
    );

    if (!containsGWDMeta) {
      throw new VError('Root .html file does not contain Google Web Designer metadata');
    }

    const hasAssets = _.filter(files, file => _.includes(file, 'assets/')).length > 0;
    const linksAssets = _.includes(rootHtmlString, 'src="assets/');

    if (linksAssets && !hasAssets) {
      throw new VError('Zip file is missing assets folder for linked assets')
    }
  }

  return true;
};

const getFiles = directoryPath => {
  return fs.existsSync(directoryPath) ? readdir(directoryPath) : [];
};

const readRootHtmlFile = rootHtmlFile => {
  return fs.readFileSync(rootHtmlFile, 'utf8');
};

const getS3UploadKey = ({ filePath, directoryToUpload, campaignId, fileBaseName, uploadId }) => {
  const s3DirectoryPath = `${campaignId}/${fileBaseName}_${uploadId}/`;
  let s3FilePath = filePath.replace(`${directoryToUpload}/`, '');

  if (_.split(s3FilePath, '/')[0] === fileBaseName) {
    s3FilePath = s3FilePath.replace(`${fileBaseName}/`, '');
  }

  return `${s3DirectoryPath}${s3FilePath}`;
};

const uploadDirectoryToS3 = async ({
  campaignId,
  directoryToUpload,
  fileBaseName,
  uploadId,
  exporter,
  flags,
}) => {
  const filesToUpload = await getFiles(path.resolve(__dirname, directoryToUpload));

  const uploadResults = [];

  for (const filePath of filesToUpload) {
    const Key = getS3UploadKey({
      filePath,
      directoryToUpload,
      campaignId,
      fileBaseName,
      uploadId,
    });

    let Body;

    if (_.includes(filePath, '.html')) {
      Body = fs.readFileSync(filePath, 'utf8');

      switch (exporter) {
        case 'gwd':
          Body = processGWDClickthroughUrls(Body);
          break;
        case 'conversion':
          Body = processConversioClickthroughUrls(Body);
          break;
        default:
          Body = processGWDClickthroughUrls(Body);
      }
    } else {
      Body = fs.readFileSync(filePath);
    }

    const Bucket = S3_CREATIVES_BUCKET;
    const ACL = S3_ACCESS_CONTROL_LIST;
    const ContentType = mime.lookup(filePath) || 'application/octet-stream';

    const params = {
      Key,
      Body,
      Bucket,
      ACL,
      ContentType,
    };

    try {
      if (flags.en_2127_upload_into_s3_and_gcs) {
        if (configs.get('creatives.uploadToGCS')) {
          await storage.bucket(GCS_CREATIVE_BUCKET_NAME).upload(filePath, {
            destination: Key,
          });
        }
      }
      await uploadObjectToS3(params);
      uploadResults.push({
        Key,
      });
    } catch (error) {
      throw new VError(error, `failed to upload ${filePath} to s3`);
    }
  }

  return uploadResults;
};

const uploadObjectToS3 = params => {
  return new Promise((resolve, reject) => {
    s3.putObject(params, (error, data) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(data);
    });
  });
};

const deleteFolderRecursively = filePath => {
  if (fs.existsSync(filePath)) {
    fs.readdirSync(filePath).forEach(file => {
      const currentPath = path.join(filePath, file);

      if (fs.lstatSync(currentPath).isDirectory()) {
        deleteFolderRecursively(currentPath);
      } else {
        fs.unlinkSync(currentPath);
      }
    });
    fs.rmdirSync(filePath);
  }
};

const removeTempFolders = () => {
  deleteFolderRecursively(UPLOAD_DIRECTORY);
  deleteFolderRecursively(EXTRACT_DIRECTORY);
};

export const processClickthroughUrls = ({ body, type = 'gwd' }) => {
  let output = body;
  const isGwd = type === 'gwd' || false;
  
  const regex = isGwd ? /.exit\([^\)]+\)/gm : /clickTag\s*=\s*["'](\S*)["']/gi;
  const urlRegex = isGwd ? /(["']https?:\/\/[^\s]+["'],)/g : /(["']https?:\/\/[^\s]+["'])/g;

  _.each(body.match(regex), params => {
    const formattedParams = params.replace(urlRegex, url => {
      let trimmedUrl;
      if (isGwd) {
        trimmedUrl = _.chain(url)
          .trimStart(`'`)
          .trimEnd(`',`)
          .trimStart(`"`)
          .trimEnd(`",`)
          .value();
      } else {
        trimmedUrl = _.chain(url)
          .trim(`'`)
          .trim(`"`)
          .value();
      }
      let decodeUri = "decodeURIComponent(window.location.href.split('?adserver=')[1]) + ";
      if (isGwd) {
        return decodeUri + `'${trimmedUrl}',`;
      }
      return decodeUri + `"${trimmedUrl}"`; 
    });
    output = output.replace(params, formattedParams);
  });

  return output;
};

export default handler;

