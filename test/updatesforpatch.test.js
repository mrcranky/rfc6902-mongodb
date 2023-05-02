import fs from 'fs';
import path from 'path';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { openDB, closeDB, clearCollection, checkUpdatesProduceCorrectResult } from './helpers.js';
import cloneDeep from 'lodash.clonedeep';
import updatesForPatch from '../updatesforpatch.js';

chai.use(chaiAsPromised);

describe('Updates For Patch', async function() {
    before('Set up mongo server', openDB);
    after('Close client', closeDB);
    afterEach('Clear collection', clearCollection);

    const exampleDocument = {
        foo: 'bar',
        baz: ['bux', 'tux'],
        sub: { middle: { bottom: 'foo' } },
        '1key': 'value',
    };

    describe('Basic operations', function() {
        it('should support no-op patches', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
            ]); 
        });

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

        it('should refuse patch documents with malformed operations', async function() {
            await expect(() => updatesForPatch([
                { "op": "badop", "path": "/b", "value": "c" },
            ], exampleDocument)).to.throw('malformed patch');
            await expect(() => updatesForPatch([
                { "path": "/b", "value": "c" }, // missing op
            ], exampleDocument)).to.throw('malformed patch');
            await expect(() => updatesForPatch([
                { "op": "add", "value": "c" }, // missing path
            ], exampleDocument)).to.throw('malformed patch');
        });

        it('should refuse to apply patches where paths contain characters MongoDB does not support', async function() {
            await expect(() => updatesForPatch([
                { "op": "add", "path": "/$badkey", "value": "x" },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { "op": "add", "path": "/sub/$badkey", "value": "x" },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { "op": "add", "path": "/sub/.key", "value": "x" },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { "op": "add", "path": "/sub/key.subkey", "value": "x" },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { "op": "add", "path": "/sub/key\0subkey", "value": "x" },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { "op": "add", "path": "/\0", "value": "x" },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { "op": "add", "path": "/", "value": "x" },
            ], exampleDocument)).to.throw('not MongoDB-safe');
        });

        it('should refuse to apply patches where values contain characters MongoDB does not support', async function() {
            await expect(() => updatesForPatch([
                { "op": "add", "path": "/badvalue", "value": { "$badkey1": "value" } },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { "op": "add", "path": "/badvalue", "value": [{ "$badkey1": "value" }] },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { "op": "add", "path": "/badvalue", "value": { "nested": { "$badkey1": "value" } } },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { "op": "add", "path": "/badvalue", "value": { "nested": { "": "value" } } },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { "op": "add", "path": "/badvalue", "value": { "nested.key": "value" } },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { "op": "add", "path": "/badvalue", "value": { ".key": "value" } },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { "op": "add", "path": "/badvalue", "value": { "key.": "value" } },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { "op": "add", "path": "/badvalue", "value": { ".": "value" } },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { "op": "add", "path": "/badvalue", "value": { "foo$bar": "value" } },
            ], exampleDocument)).to.not.throw('not MongoDB-safe');
        });
    });

    describe('Add operations', function() {
        it('should support add value operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "add", "path": "/bar", "value": "mux" },
            ]); 
        });

        it('should support add value operations in a nested document', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "add", "path": "/sub/foo", "value": "bar" },
            ]); 
        });

        it('should support building deep nesting through sequential operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "add", "path": "/top", "value": {} },
                { "op": "add", "path": "/top/middle", "value": {} },
                { "op": "add", "path": "/top/middle/bottom", "value": "bar" },
            ]); 
        });

        it('should support building deep nesting through a single operation', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "add", "path": "/top", "value": { "middle": { "bottom": "bar" } } },
            ]); 
        });

        it('should refuse to add to an object which does not yet exist', async function() {
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "add", "path": "/pub/foo", "value": "bar" },
            ])).to.be.rejectedWith('path does not exist');
        });
    });

    describe('Remove operations', function() {
        it('should support remove value operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "remove", "path": "/foo" },
            ]); 
        });

        it('should support remove value operations on keys which start with numbers', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "remove", "path": "/1key" },
            ]); 
        });

        it('should support removing nested objects even if modified in previous operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "replace", "path": "/sub/middle/bottom", "value": "bar" },
                { "op": "remove", "path": "/sub/middle/bottom" },
                { "op": "remove", "path": "/sub" },
            ]); 
        });

        it('should refuse to remove from an object a field which does not exist', async function() {
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "remove", "path": "/pub" },
            ])).to.be.rejectedWith('path does not exist');
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "remove", "path": "/pub/foo" },
            ])).to.be.rejectedWith('path does not exist');
        });
    });

    describe('Replace operations', function() {
        it('should support replace value operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "replace", "path": "/foo", value: "baz" },
            ]); 
        });

        it('should refuse to replace a field which does not exist', async function() {
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "replace", "path": "/notreal", "value": "mux" },
            ])).to.be.rejectedWith('path which does not exist');
        });
    });

    describe('Add/replace/remove operations on arrays', function() {
        it('should support add to end of array operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "add", "path": "/baz/-", "value": "mux" },
            ]); 
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "add", "path": "/baz/2", "value": "mux" },
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

        it('should refuse to add to an index outside of the bounds of the array', async function() {
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "add", "path": "/baz/-1", "value": "mux" },
            ])).to.be.rejectedWith('Out of bounds (lower)');
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "add", "path": "/baz/3", "value": "mux" },
            ])).to.be.rejectedWith('Out of bounds (upper)');
        });

        it('should refuse to remove an index outside of the bounds of the array', async function() {
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "remove", "path": "/baz/-1", "value": "mux" },
            ])).to.be.rejectedWith('Out of bounds (lower)');
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "remove", "path": "/baz/2", "value": "mux" },
            ])).to.be.rejectedWith('Out of bounds (upper)');
        });

        it('should refuse to replace an index outside of the bounds of the array', async function() {
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "replace", "path": "/baz/-1", "value": "mux" },
            ])).to.be.rejectedWith('path which does not exist');
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "replace", "path": "/baz/2", "value": "mux" },
            ])).to.be.rejectedWith('path which does not exist');
        });
    });

    describe('Copy operations', function() {
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

        it('should refuse to copy from a location which does not exist', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "copy", "from": "/nonexistent", "path": "/existent" },
            ], 'from does not exist');
        });
    });

    describe('Move operations', function() {
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

        it('should refuse to move from a location which does not exist', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "move", "from": "/nonexistent", "path": "/existent" },
            ], 'from does not exist');
        });

        it('should refuse move operations to a child of the source', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "move", "from": "/sub", "path": "/sub/newchild" },
            ], 'Cannot move object to a child of that object');
        });
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

            // Not supported because they would replace the target document rather than update it
            /.*replace object document with array.*/,
            /.*replace whole document.*/,
            /.*replacing the root of the document.*/,

            // Not supported because they would produce a document with empty keys
            /.*Add. \/ target.*/,
            /.*Add. \/foo\/ deep target.*/,
            /.*Empty-string element.*/
        ];
        const filteredTests = standardTests.filter(test => {
            if (Array.isArray(test.doc)) {
                return false; // Skip tests where the document being patched is an array (which we don't support)
            }
            if (typeof(test.doc) !== 'object') {
                return false; // Skip tests where the document being patched is not an object (which we don't support)
            }
            const operationPaths = test.patch?.map(operation => operation.path);
            const unsupportedPaths = operationPaths.filter(path => (path?.endsWith('/')));
            if (unsupportedPaths.length > 0) {
                // Skip tests that are trying to set empty keys (which we don't support)
                return false;
            }
            for (const blacklistEntry of blacklist) {
                if (test.comment && test.comment.match(blacklistEntry)) {
                    return false;
                }
            }
            return true;
        });
        for (const [index, standardTest] of Object.entries(filteredTests)) {
            const name = standardTest.comment || standardTest.error || `#${index} (${JSON.stringify(standardTest.patch)})`;
            it(`should pass standard test case: ${name}`, async function() {
                await checkUpdatesProduceCorrectResult(this.test.title, standardTest.doc, standardTest.patch, standardTest.error);
            });
        }
    });
});

