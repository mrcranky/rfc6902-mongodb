import fs from 'fs';
import path from 'path';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { openDB, closeDB, clearCollection, checkUpdatesProduceCorrectResult } from './helpers.js';
import cloneDeep from 'lodash.clonedeep';

chai.use(chaiAsPromised);

describe('Updates For Patch', async function() {
    before('Set up mongo server', openDB);
    after('Close client', closeDB);
    afterEach('Clear collection', clearCollection);

    const exampleDocument = {
        foo: 'bar',
        baz: ['bux', 'tux'],
    };

    describe('Basic operations', function() {
        it('should support add value operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "add", "path": "/bar", "value": "mux" },
            ]); 
        });
        it('should support remove value operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "remove", "path": "/foo" },
            ]); 
        });
        it('should support replace value operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "replace", "path": "/foo", value: "baz" },
            ]); 
        });
        it('should support add to end of array operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "add", "path": "/baz/-", "value": "mux" },
            ]); 
        });
        it('should support insert mid-array operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "add", "path": "/baz/0", "value": "mux" },
            ]); 
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "add", "path": "/baz/1", "value": "mux" },
            ]);
        });
        it('should support remove mid-array operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "remove", "path": "/baz/0" },
            ]); 
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "remove", "path": "/baz/1" },
            ]); 
        });

        it('should support replace value mid-array operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "replace", "path": "/baz/0", value: "mux" },
            ]); 
        });
        it('should support copy operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "copy", "from": "/baz", "path": "/maz" },
            ]); 
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "copy", "from": "/foo", "path": "/boo" },
            ]); 
        });
        it('should support copy operations from arrays', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "copy", "from": "/baz/0", "path": "/maz" },
            ]);
        });
        it('should support copy operations to arrays', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "copy", "from": "/foo", "path": "/baz/0" },
            ]);
        });
        it('should support move operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "move", "from": "/baz", "path": "/maz" },
            ]); 
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "move", "from": "/foo", "path": "/boo" },
            ]); 
        });
        it('should support move operations from arrays', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "move", "from": "/baz/0", "path": "/maz" },
            ]);
        });
        it('should support move operations to arrays', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "move", "from": "/foo", "path": "/baz/0" },
            ]);
        });
    });

    describe('Validity checking', function() {
        it('should not modify the original document passed in', async function() {
            const documentPrior = cloneDeep(exampleDocument);
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "move", "from": "/foo", "path": "/baz/0" },
            ]);
            expect(documentPrior).to.deep.equal(exampleDocument);
        });
        it('should not modify the patch document passed in', async function() {
            const patch = [
                { "op": "move", "from": "/foo", "path": "/baz/0" },
            ];
            const patchPrior = cloneDeep(patch);
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, patch);
            expect(patchPrior).to.deep.equal(patch);
        });

        it('should refuse to add to an index outside of the bounds of the array', async function() {
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "add", "path": "/baz/-1", "value": "mux" },
            ])).to.be.rejectedWith('non-existent index');
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "add", "path": "/baz/2", "value": "mux" },
            ])).to.be.rejectedWith('non-existent index');
        });
        it('should refuse to remove an index outside of the bounds of the array', async function() {
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "remove", "path": "/baz/-1", "value": "mux" },
            ])).to.be.rejectedWith('non-existent index');
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "remove", "path": "/baz/2", "value": "mux" },
            ])).to.be.rejectedWith('non-existent index');
        });
        it('should refuse to replace an index outside of the bounds of the array', async function() {
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "replace", "path": "/baz/-1", "value": "mux" },
            ])).to.be.rejectedWith('path which does not exist');
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "replace", "path": "/baz/2", "value": "mux" },
            ])).to.be.rejectedWith('path which does not exist');
        });
        it('should refuse to replace a field which does not exist', async function() {
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "replace", "path": "/notreal", "value": "mux" },
            ])).to.be.rejectedWith('path which does not exist');
        });

        it('should refuse to apply patches to arrays or non-object targets');
        it('should refuse to apply patches where paths contain characters MongoDB does not support');
        it('should refuse to apply patches where values contain characters MongoDB does not support');
        it('should refuse to perform add operations if the field did exist in the original document');
        it('should refuse to perform replace operations if the field did not exist in the original document');
        it('should refuse to perform add-to-end-of-array operations if the field specified is not an array');
        it('should refuse to perform insert mid-array operations if the field specified is not an array or an object');
        it('should refuse to perform remove operations if the field specified is not an array or an object');
        it('should refuse to perform remove mid-array operations if the field specified is not an array or an object');
    });

    describe('Test operations', function() {
        it('should respect test operation conditions that fail', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "test", "path": "/foo", "value": "cheese" }, // should fail
                { "op": "replace", "path": "/foo", "value": "baz" },
            ]);
        });

        it('should respect test operation conditions that succeed', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "test", "path": "/foo", "value": "bar" }, // should fail
                { "op": "replace", "path": "/foo", "value": "baz" },
            ]);
        });

        it('should respect test operation conditions on non-existent fields', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "test", "path": "/bar", "value": "cheese" }, // should fail
                { "op": "replace", "path": "/foo", "value": "baz" },
            ]);
        });
    });

    describe('Efficiency tests', function() {
        it('should be able to coalesce multiple update operations on the same field into a single update');
        it('should be able to coalesce multiple update operations on unrelated fields into a single operation');
        it('should be able to discard operations rendered redundant by a subsequent remove operation');
        it('should refuse to coalesce operations that would cause conflicts within a single MongoDB update');
    });

    describe('Standard JSON patch tests', function() {
        // Loop through all the test patches in the standard set.
        // Aside from a few unsupported operations we skip, all should pass.
        // Tests are taken from https://github.com/json-patch/json-patch-tests/blob/master/tests.json
        const standardTests = JSON.parse(fs.readFileSync(path.join('test', 'standard-tests.json')));
        const blacklist = [
            // Cases describing unsupported operations
            /.*replace object document with array.*/,
            /.*replace whole document.*/,
            /.*replacing the root of the document.*/,
            /.*Add. \/ target.*/, // Not supported because it would produce a document with empty keys
            /.*Add. \/foo\/ deep target.*/,
        ];
        const filteredTests = standardTests.filter(test => {
            if (Array.isArray(test.doc)) {
                return false; // Skip tests where the document being patched is an array (which we don't support)
            }
            if (typeof(test.doc) !== 'object') {
                return false; // Skip tests where the document being patched is not an object (which we don't support)
            }
            for (const blacklistEntry of blacklist) {
                if (test.comment && test.comment.match(blacklistEntry)) {
                    return false;
                }
            }
            if (test.error) {
                return false; // Positive tests only
            }
            return true;
        });
        for (const [index, standardTest] of Object.entries(filteredTests)) {
            const name = standardTest.comment || standardTest.error || index;
            it(`should pass standard test case: ${name}`, async function() {
                await checkUpdatesProduceCorrectResult(this.test.title, standardTest.doc, standardTest.patch);
            });
        }
    });
});

