# Pelmorex EngageFront Assessment

This test will evaluate your ability to:
 - read and understand the code
 - refactor existing and create new code following the best practices of SOLID, Clean Code and Object Calisthenics (if you know it)
 - use DRY approach
 - write meaningful git commit messages
 - create, refactor and extend unit tests

### Setup
From the root directory, run `npm install`

### Run Tests
From the root directory, run `npm test`

### Context
- What's the feature?
	- What's a "processor"?
	-- The processor is used to validate a set of rules and replace certain values inside a html file.
	- What's a "clickTag"?
	-- a clickTag is a variable present in HTML5 Ad Creatives and it carries the url that will be opened when the ad is clicked by the user.
	- What's the "meta" tag?
	-- meta is the `<meta>` html tag. We look for specific meta values to determinate if the html files is a valid HTML5 Ad Creative.
- How is this code normally used?
	- What's the handler for?
	-- The handler is responsible to control the flow from the moment we receive the request until we save the result of the processor.
	- What's the inputs and outputs?
	-- The handler receives a ZIP file and outputs the content of the ZIP file into a Storage in the clound.
   - What is the flow control?
   -- Get the ZIP -> extract -> validate content -> process content -> save result


### Requirements
* Except for the first commit when you create your git repo, DO NOT commit to the main/master repository directly. We use branch-based developement.
* Create a repository in your github account 
* Add the content of this zip file to your repository with the commit message "First commit"
* This assessment was created using node 16. We think you shouldn't face any problem by using a newer node version.

## Exercise 1 - Refactor

In the folder **urban** you will find 3 files:
- mock.js that contains 2 mocked functions. Do not touch this file
- handler.js contains the logic to be refactored
- handler.spec.js contains the unit tests
 
You must refactor the functions:
- validateConversioZipFile
- validateGWDZipFile
- processGWDClickthroughUrls
- processConversioClickthroughUrls
- validateFile

The refactoring strategy is up to you. You are allowed to:
- create new files and folders
- use TS if you feel more comfortable
- create classes, interfaces, functions and anything else you find useful
- rename things (functions, variables, etc)
- import/export modules you create

## Exercise 2 - Add a new processor

Add a new processor that:
- validates whether a zip file contains a **.html** file in the root
--  if NOT, throw an error "Zip file does not contain a root .html file"
--  if the .html file is empty throws an error "Root .html file is missing content"
- validates if .html contains `<meta name="ad.size" content="width=[x],height=[y]">` where **x** and **y** are integers
--if NOT, throws an error "Root .html file does not contain ad size meta tag"
- in the .html file find `clickTag = 'https://www.google.com';` and replace it with `clickTag = decodeURIComponent(window.location.href.split('?adserver=')[1]) + 'https://www.google.com';`

**Do not forget to add the unit tests.**
