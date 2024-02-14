
# Change Log
All notable changes to this project will be documented in this file.
 
The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## Unreleased
  
### Changed
- Updated packages to avoid high severity security vulnerabilities 

## [1.0.4] - 2024-01-25
  
### Changed
- Shifted to using lodash@4.17.21 since a build using lodash-es that works locally doesn't work on GitHub runners 

## [1.0.3] - 2024-01-25
  
### Changed
- Shifted to using lodash-es@4.17.21 to avoid a high severity vulnerability (since the [per-method packages are effectively deprecated](https://github.com/lodash/lodash/issues/3838#issuecomment-398592530))

## [1.0.2] - 2024-01-17
  
### Fixed
- [Issue #3](https://github.com/mrcranky/rfc6902-mongodb/issues/3): Modifying an array that was a child of another array that also modified in the same patch would generate a conflicting update

### Changed
- Minor dependency updates to address security advisories, all in devDependencies

## [1.0.1] - 2023-12-10

### Changed
- Added SECURITY policy

## [0.2.0] - 2023-12-05

### Changed
- Use rollup to build both CJS and ESM forms of the module so that 
`require('rfc6902-mongodb')` will also work
 
## [0.1.6] - 2023-12-02
  
### Fixed
- [Issue #2](https://github.com/mrcranky/rfc6902-mongodb/issues/2): Picking up rfc6902@5.1.1 with a better fix for the array related issues
 
## [0.1.5] - 2023-12-02
  
### Fixed
- [Issue #2](https://github.com/mrcranky/rfc6902-mongodb/issues/2): Inserting then modifying array values would not produce correct results

## [0.1.4] - 2023-11-25

### Fixed
- README links
- Botched release process due to lack of practice
 
## [0.1.3] - 2023-11-25
  
### Fixed
- [Issue #1](https://github.com/mrcranky/rfc6902-mongodb/issues/1): Appending objects to arrays over multiple patch operations was not handled correctly

### Changed
- Minor dependency updates to address security advisories; all but one (uuid patch to 9.0.1) in devDependencies
- Major dev dependency updates, no breaking changes so no updates needed:
    - mongodb to 6.3.0
    - mongodb-memory-server to 9.1.1
    - eslint-plugin-n to 16.3.1
 
## [0.1.2] - 2023-08-24
  
### Changed
- Minor dependency updates to address security advisories (all in devDependencies)
 
## [0.1.1] - 2023-05-04
 
### Fixed
- Make behaviour conformant with most remaining tests from https://github.com/json-patch/json-patch-tests/blob/master/spec_tests.json
- Fix behaviour for RFC6902/4.4: The "from" location MUST NOT be a proper prefix of the "path" location; i.e., a location cannot be moved into one of its children.
 
