import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { openDB, closeDB, clearCollection, checkUpdatesProduceCorrectResult } from './helpers.js';

chai.use(chaiAsPromised);

describe('Updates For Patch', async function() {
    before('Set up mongo server', openDB);
    after('Close client', closeDB);
    afterEach('Clear collection', clearCollection);

    const exampleDocument = {
        foo: 'bar',
        baz: ['bux', 'tux'],
    };

    describe('Basic operations', async function() {
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

        it('should not modify the original document passed in');
        it('should not modify the patch document passed in');
    });

    describe('Validity checking', async function() {
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

        it('should refuse to apply patches where paths contain characters MongoDB does not support');
        it('should refuse to apply patches where values contain characters MongoDB does not support');
        it('should refuse to perform add operations if the field did exist in the original document');
        it('should refuse to perform replace operations if the field did not exist in the original document');
        it('should refuse to perform add-to-end-of-array operations if the field specified is not an array');
        it('should refuse to perform insert mid-array operations if the field specified is not an array or an object');
        it('should refuse to perform remove operations if the field specified is not an array or an object');
        it('should refuse to perform remove mid-array operations if the field specified is not an array or an object');
    });

    describe('Test operations', async function() {
        it('should apply patches only if the original document matches conditions specified in test operations');
    });

    describe('Efficiency tests', async function() {
        it('should be able to coalesce multiple update operations on the same field into a single update');
        it('should be able to coalesce multiple update operations on unrelated fields into a single operation');
        it('should be able to discard operations rendered redundant by a subsequent remove operation');
        it('should refuse to coalesce operations that would cause conflicts within a single MongoDB update');
    });

    describe('Standard JSON patch tests', async function() {
        // Loop through all the test patches in the standard set.
        // Aside from a few unsupported operations we skip, all should pass.
    });
});

