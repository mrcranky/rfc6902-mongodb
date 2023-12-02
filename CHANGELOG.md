
# Change Log
All notable changes to this project will be documented in this file.
 
The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).
 
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
 