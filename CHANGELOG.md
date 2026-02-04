
# Change Log
All notable changes to this project will be documented in this file.
 
The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [1.0.14] - 2026-02-04

### Changed
- Minor changes to CI process


## [1.0.12] - 2026-02-04

### Changed
- Patch update to lodash to squish a security advisory
- Updates to development packages (notably chai@6, mongodb@7, mongodb-memory-server@11)
- Minor changes to CI process

## [1.0.11] - 2025-11-21

### Changed
- Minor and patch updates to development packages and uuid (will squish a security advisory from indirect use of glob)

## [1.0.10] - 2024-12-20

### Changed
- Major dependency update: uuid@11
- Major development dependency updates: mocha@11, mongodb-memory-server
- Minor and patch updates to development packages

### Fixed
- Fixed tests timing out on first run

## [1.0.9] - 2024-09-27

### Changed
- Minor and patch updates to development packages

## [1.0.8] - 2024-06-25

### Changed
- Minor and patch updates to development packages
- Update to eslint@9
- Update to uuid@10

## [1.0.6] - 2024-03-26
  
### Changed
- Shift to chai@5 and a fork of chai-as-promised that supports it
- Minor and patch updates to development packages

## [1.0.5] - 2024-02-14
  
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
 
