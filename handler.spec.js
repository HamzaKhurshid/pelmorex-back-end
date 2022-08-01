import { expect } from 'chai';
import _ from 'lodash';
import sinon from 'sinon';

import {
  validateZipFile,
  processClickthroughUrls
} from './handler.js';

describe('campaign creatives zip file upload validators', () => {
  describe('validateZipFile for GWD', () => {
    it('calls correct dependencies for gwd zip upload', async () => {
      const _getFiles = sinon.stub().returns(['testZipFile.html']);
      const _readRootHtmlFile = sinon
        .stub()
        .returns(`<meta name="generator" content="Google Web Designer"/>`);

      await validateZipFile({
        type: 'gwd',
        fileBaseName: 'testZipFile',
        directoryToUpload: 'testUploadDirectory',
        _getFiles,
        _readRootHtmlFile,
      });

      expect(_getFiles.called).to.eql(true);
      expect(_readRootHtmlFile.called).to.eql(true);
    });

    it('should accept valid gwd zip files', async () => {
      const _getFiles = sinon.stub().returns(['gwd-test-a.html', 'assets/test-image.png']);
      const _readRootHtmlFile = sinon.stub().returns(`
                <meta name="generator" content="Google Web Designer"/>
                <image src="assets/test-image.png"/>
            `);

      const isValid = await validateZipFile({
        type: 'gwd',
        fileBaseName: 'gwd-test-a',
        directoryToUpload: 'testUploadDirectory',
        _getFiles,
        _readRootHtmlFile,
      });

      expect(isValid).to.eql(true);
    });

    it('should accept valid gwd zip files with parens in file name', async () => {
      const _getFiles = sinon.stub().returns(['gwd-test-a.html', 'assets/test-image.png']);
      const _readRootHtmlFile = sinon.stub().returns(`
                <meta name="generator" content="Google Web Designer"/>
                <image src="assets/test-image.png"/>
            `);

      const isValid = await validateZipFile({
        type: 'gwd',
        fileBaseName: 'gwd-test-a (1)',
        directoryToUpload: 'testUploadDirectory',
        _getFiles,
        _readRootHtmlFile,
      });

      expect(isValid).to.eql(true);
    });

    it('should reject zip file with missing root html file', async () => {
      const _getFiles = sinon.stub().returns([]);
      const _readRootHtmlFile = sinon
        .stub()
        .returns(`<meta name="generator" content="Google Web Designer"/>`);
      let isValid;

      try {
        isValid = await validateZipFile({
          type: 'gwd',
          fileBaseName: 'gwd-test-a',
          directoryToUpload: 'testUploadDirectory',
          _getFiles,
          _readRootHtmlFile,
        });
      } catch (err) {
        expect(err.message).to.eql('Zip file does not contain a root .html file');
      }

      expect(isValid).to.eql(undefined);
    });

    it('should reject zip file where root html file is missing content', async () => {
      const _getFiles = sinon.stub().returns(['gwd-test-a.html']);
      const _readRootHtmlFile = sinon.stub().returns('');
      let isValid;

      try {
        isValid = await validateZipFile({
          type: 'gwd',
          fileBaseName: 'gwd-test-a',
          directoryToUpload: 'testUploadDirectory',
          _getFiles,
          _readRootHtmlFile,
        });
      } catch (err) {
        expect(err.message).to.eql('Root .html file is missing content');
      }

      expect(isValid).to.eql(undefined);
    });

    it('should reject zip file where root html file does not contain GWD metadata', async () => {
      const _getFiles = sinon.stub().returns(['gwd-test-a.html']);
      const _readRootHtmlFile = sinon.stub().returns('<meta/>');
      let isValid;

      try {
        isValid = await validateZipFile({
          type: 'gwd',
          fileBaseName: 'gwd-test-a',
          directoryToUpload: 'testUploadDirectory',
          _getFiles,
          _readRootHtmlFile,
        });
      } catch (err) {
        expect(err.message).to.eql(
          'Root .html file does not contain Google Web Designer metadata'
        );
      }

      expect(isValid).to.eql(undefined);
    });

    it('should reject zip file where assets folder is missing for linked assets', async () => {
      const _getFiles = sinon.stub().returns(['gwd-test-a.html']);
      const _readRootHtmlFile = sinon.stub().returns(`
                <meta name="generator" content="Google Web Designer"/>
                <image src="assets/test-image.png"/>
            `);
      let isValid;

      try {
        isValid = await validateZipFile({
          type: 'gwd',
          fileBaseName: 'gwd-test-a',
          directoryToUpload: 'testUploadDirectory',
          _getFiles,
          _readRootHtmlFile,
        });
      } catch (err) {
        expect(err.message).to.eql('Zip file is missing assets folder for linked assets');
      }

      expect(isValid).to.eql(undefined);
    });

    it('should reject zip file where root html file base name is not in zip file base name', async () => {
      const _getFiles = sinon.stub().returns(['gwd-test-b.html', 'assets/test-image.png']);
      const _readRootHtmlFile = sinon.stub().returns(`
                <meta name="generator" content="Google Web Designer"/>
                <image src="assets/test-image.png"/>
            `);
      let isValid;

      try {
        isValid = await validateZipFile({
          type: 'conversion',
          fileBaseName: 'gwd-test-a (1)',
          directoryToUpload: 'testUploadDirectory',
          _getFiles,
          _readRootHtmlFile,
        });
      } catch (err) {
        expect(err.message).to.eql(
          `Zip file name 'gwd-test-a (1)' does not contain basename 'gwd-test-b'`
        );
      }

      expect(isValid).to.eql(undefined);
    });
  });

  describe('validateZipFile for coversion', () => {
    it('calls correct dependencies for conversion zip upload', async () => {
      const _getFiles = sinon.stub().returns(['testZipFile.html']);
      const _readRootHtmlFile = sinon
        .stub()
        .returns(`<meta name="generator" content="Google Web Designer"/>`);

      await validateZipFile({
        type: 'conversion',
        fileBaseName: 'testZipFile',
        directoryToUpload: 'testUploadDirectory',
        _getFiles,
        _readRootHtmlFile,
      });

      expect(_getFiles.called).to.eql(true);
      expect(_readRootHtmlFile.called).to.eql(true);
    });

    it('should accept valid conversion zip files', async () => {
      const _getFiles = sinon
        .stub()
        .returns(['conversio-test-a.html', 'images/test-image.png']);
      const _readRootHtmlFile = sinon.stub().returns(`
                <image src="images/test-image.png"/>
            `);

      const isValid = await validateZipFile({
        type: 'conversion',
        fileBaseName: 'conversio-test-a',
        directoryToUpload: 'testUploadDirectory',
        _getFiles,
        _readRootHtmlFile,
      });

      expect(isValid).to.eql(true);
    });

    it('should accept valid conversio zip files with parens in file name', async () => {
      const _getFiles = sinon
        .stub()
        .returns(['conversio-test-a.html', 'images/test-image.png']);
      const _readRootHtmlFile = sinon.stub().returns(`
                <image src="images/test-image.png"/>
            `);

      const isValid = await validateZipFile({
        type: 'conversion',
        fileBaseName: 'conversio-test-a (1)',
        directoryToUpload: 'testUploadDirectory',
        _getFiles,
        _readRootHtmlFile,
      });

      expect(isValid).to.eql(true);
    });

    it('should reject zip file with missing root html file', async () => {
      const _getFiles = sinon.stub().returns([]);
      const _readRootHtmlFile = sinon.stub().returns(`<meta/>`);
      let isValid;

      try {
        isValid = await validateZipFile({
          type: 'conversion',
          fileBaseName: 'conversio-test-a',
          directoryToUpload: 'testUploadDirectory',
          _getFiles,
          _readRootHtmlFile,
        });
      } catch (err) {
        expect(err.message).to.eql('Zip file does not contain a root .html file');
      }

      expect(isValid).to.eql(undefined);
    });

    it('should reject zip file where root html file is missing content', async () => {
      const _getFiles = sinon.stub().returns(['conversio-test-a.html']);
      const _readRootHtmlFile = sinon.stub().returns('');
      let isValid;

      try {
        isValid = await validateZipFile({
          type: 'conversion',
          fileBaseName: 'conversio-test-a',
          directoryToUpload: 'testUploadDirectory',
          _getFiles,
          _readRootHtmlFile,
        });
      } catch (err) {
        expect(err.message).to.eql('Root .html file is missing content');
      }

      expect(isValid).to.eql(undefined);
    });

    it('should reject zip file where root html file base name is not in zip file base name', async () => {
      const _getFiles = sinon
        .stub()
        .returns(['conversio-test-b.html', 'images/test-image.png']);
      const _readRootHtmlFile = sinon.stub().returns(`
                <image src="images/test-image.png"/>
            `);
      let isValid;

      try {
        isValid = await validateZipFile({
          type: 'conversion',
          fileBaseName: 'conversio-test-a (1)',
          directoryToUpload: 'testUploadDirectory',
          _getFiles,
          _readRootHtmlFile,
        });
      } catch (err) {
        expect(err.message).to.eql(
          `Zip file name 'conversio-test-a (1)' does not contain basename 'conversio-test-b'`
        );
      }

      expect(isValid).to.eql(undefined);
    });
  });

  describe('processClickthroughUrls', () => {
    it('should process all clickthrough urls with a redirect macro', () => {
      const rawSingleUrlBody = `
                <script type="text/javascript" gwd-events="handlers">
                    gwd.auto_Btn_Exit_1Action = function(event) {
                        // GWD Predefined Function
                        gwd.actions.gwdGoogleAd.exit('gwd-ad', 'Btn-Exit', 'http://www.google.com/', true, true);
                    };
                </script>
            `;
      const processedSingleUrlBody = `
                <script type="text/javascript" gwd-events="handlers">
                    gwd.auto_Btn_Exit_1Action = function(event) {
                        // GWD Predefined Function
                        gwd.actions.gwdGoogleAd.exit('gwd-ad', 'Btn-Exit', decodeURIComponent(window.location.href.split('?adserver=')[1]) + 'http://www.google.com/', true, true);
                    };
                </script>
            `;
      const rawMultiUrlBody = `
                <script type="text/javascript" gwd-events="handlers">
                    gwd.auto_Btn_Exit_1Action = function(event) {
                        gwd.actions.gwdGoogleAd.exit('gwd-ad', 'Btn-Exit', 'https://www.google.com/', true, true);
                    };
                    gwd.auto_Btn_Exit_2Action = function(event) {
                        gwd.actions.gwdGoogleAd.exit('gwd-ad', 'Btn-Exit', 'https://www.google.ca', true, true);
                    };
                    gwd.auto_Btn_Exit_3Action = function(event) {
                        gwd.actions.gwdGoogleAd.exit('gwd-ad', 'Btn-Exit', 'https://www.google.co.uk', true, true);
                    };
                    gwd.auto_Btn_Exit_4Action = function(event) {
                        gwd.actions.gwdGoogleAd.exit('gwd-ad', 'Btn-Exit', 'https://google.org', true, true);
                    };
                    gwd.auto_Btn_Exit_5Action = function(event) {
                        gwd.actions.gwdGoogleAd.exit('gwd-ad', 'Btn-Exit', "https://google.org", true, true);
                    };
                </script>
            `;
      const processedMultiUrlBody = `
                <script type="text/javascript" gwd-events="handlers">
                    gwd.auto_Btn_Exit_1Action = function(event) {
                        gwd.actions.gwdGoogleAd.exit('gwd-ad', 'Btn-Exit', decodeURIComponent(window.location.href.split('?adserver=')[1]) + 'https://www.google.com/', true, true);
                    };
                    gwd.auto_Btn_Exit_2Action = function(event) {
                        gwd.actions.gwdGoogleAd.exit('gwd-ad', 'Btn-Exit', decodeURIComponent(window.location.href.split('?adserver=')[1]) + 'https://www.google.ca', true, true);
                    };
                    gwd.auto_Btn_Exit_3Action = function(event) {
                        gwd.actions.gwdGoogleAd.exit('gwd-ad', 'Btn-Exit', decodeURIComponent(window.location.href.split('?adserver=')[1]) + 'https://www.google.co.uk', true, true);
                    };
                    gwd.auto_Btn_Exit_4Action = function(event) {
                        gwd.actions.gwdGoogleAd.exit('gwd-ad', 'Btn-Exit', decodeURIComponent(window.location.href.split('?adserver=')[1]) + 'https://google.org', true, true);
                    };
                    gwd.auto_Btn_Exit_5Action = function(event) {
                        gwd.actions.gwdGoogleAd.exit('gwd-ad', 'Btn-Exit', decodeURIComponent(window.location.href.split('?adserver=')[1]) + 'https://google.org', true, true);
                    };
                </script>
            `;

      expect(processClickthroughUrls({ body: rawSingleUrlBody, type: 'gwd' })).to.eql(processedSingleUrlBody);
      expect(processClickthroughUrls({ body: rawMultiUrlBody, type: 'gwd' })).to.eql(processedMultiUrlBody);
    });
  });

  describe('processClickthroughUrls', () => {
    it('should process all clickthrough urls with a redirect macro', () => {
      const expectedOutputWithVar = `
                <script>
                    var clickTag = decodeURIComponent(window.location.href.split('?adserver=')[1]) + "http://plancherspayless.com/fr/"
                </script>
            `;
      const expectedOutputWithLet = `
                <script>
                    let clickTag = decodeURIComponent(window.location.href.split('?adserver=')[1]) + "http://plancherspayless.com/fr/"
                </script>
            `;
      const expectedOutputWithConst = `
                <script>
                    const clickTag = decodeURIComponent(window.location.href.split('?adserver=')[1]) + "http://plancherspayless.com/fr/"
                </script>
            `;
      const expectedOutputWithCase = `
                <script>
                    var ClickTAG = decodeURIComponent(window.location.href.split('?adserver=')[1]) + "http://plancherspayless.com/fr/"
                </script>
            `;
      const expectedOutputWithSpace = `
                <script>
                    var clickTag  =  decodeURIComponent(window.location.href.split('?adserver=')[1]) + "http://plancherspayless.com/fr/"
                </script>
            `;
      const expectedOutputWithNoSpace = `
                <script>
                    var clickTag=decodeURIComponent(window.location.href.split('?adserver=')[1]) + "http://plancherspayless.com/fr/"
                </script>
            `;

      expect(
        processClickthroughUrls({
          body: `
                <script>
                    var clickTag = "http://plancherspayless.com/fr/"
                </script>
            `,
          type: 'conversion'
        })
      ).to.eql(expectedOutputWithVar);

      expect(
        processClickthroughUrls({
          body: `
                <script>
                    var clickTag = 'http://plancherspayless.com/fr/'
                </script>
            `,
          type: 'conversion'
        })
      ).to.eql(expectedOutputWithVar);

      expect(
        processClickthroughUrls({
          body: `
                <script>
                    let clickTag = "http://plancherspayless.com/fr/"
                </script>
            `,
          type: 'conversion'
        })
      ).to.eql(expectedOutputWithLet);

      expect(
        processClickthroughUrls({
          body: `
                <script>
                    const clickTag = "http://plancherspayless.com/fr/"
                </script>
            `,
          type: 'conversion'
        })
      ).to.eql(expectedOutputWithConst);

      expect(
        processClickthroughUrls({
          body: `
                <script>
                    var ClickTAG = "http://plancherspayless.com/fr/"
                </script>
            `,
          type: 'conversion'
        })
      ).to.eql(expectedOutputWithCase);

      expect(
        processClickthroughUrls({
          body: `
                <script>
                    var clickTag  =  "http://plancherspayless.com/fr/"
                </script>
            `,
          type: 'conversion'
        })
      ).to.eql(expectedOutputWithSpace);

      expect(
        processClickthroughUrls({
          body: `
                <script>
                    var clickTag="http://plancherspayless.com/fr/"
                </script>
            `,
          type: 'conversion'
        })
      ).to.eql(expectedOutputWithNoSpace);
    });
  });
});
