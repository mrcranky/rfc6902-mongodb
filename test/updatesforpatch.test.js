import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { openDB, closeDB, clearCollection, checkUpdatesProduceCorrectResult } from './helpers.js';

chai.use(chaiAsPromised);

describe('Updates For Patch', async function() {
    before('Set up mongo server', openDB);
    after('Close client', closeDB);
    afterEach('Clear collection', clearCollection);

    describe('Basic operations', async function() {
        const exampleDocument = {
            foo: 'bar',
            baz: ['bux', 'tux'],
        };

        it('should support add value operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "add", "path": "/bar", "value": "mux" },
            ]); 
        });
        it('should support remove value operations');
        it('should support replace value operations');
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
        it('should support remove mid-array operations');
        it('should support copy operations');
        it('should support copy operations from arrays');
        it('should support copy operations to arrays');
        it('should support move operations');
        it('should support move operations from arrays');
        it('should support move operations to arrays');

        it('should not modify the original document passed in');
        it('should not modify the patch document passed in');

        it('should refuse to add to an index outside of the bounds of the array', async function() {
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { "op": "add", "path": "/baz/2", "value": "mux" },
            ])).to.be.rejectedWith('non-existent index');
        });
    });

    describe('Test operations', async function() {
        it('should apply patches only if the original document matches conditions specified in test operations');
    });

    describe('Incompatibility  tests', async function() {
        it('should refuse to apply patches where paths contain characters MongoDB does not support');
        it('should refuse to apply patches where values contain characters MongoDB does not support');
        it('should refuse to perform add operations if the field did exist in the original document');
        it('should refuse to perform replace operations if the field did not exist in the original document');
        it('should refuse to perform add-to-end-of-array operations if the field specified is not an array');
        it('should refuse to perform insert mid-array operations if the field specified is not an array or an object');
        it('should refuse to perform remove operations if the field specified is not an array or an object');
        it('should refuse to perform remove mid-array operations if the field specified is not an array or an object');
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

