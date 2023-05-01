import { expect } from 'chai';
import { openDB, closeDB } from './helpers.js';

// Test of the test rig (does not exercise module code)
describe('Test that mongodb updates can be performed', async function() {
    let client;
    let db;
    let collection;
    before('Set up mongo server', async function() {
        const results = await openDB();
        client = results.client;
        db = results.db;
        collection = results.collection;
    });
    after('Close client', async function() {
        await closeDB(client, db);
    });

    afterEach('Clear collection', async function() {
        await collection.deleteMany({});
    });

    it('can insert a simple document and retrieve it after', async function() {
        const document1 = {
            foo: 'bar',
        };
        const result1 = await collection.insertOne(document1);
        const document2 = await collection.findOne(document1);
        expect(document2._id).to.equal(result1.insertedId);
        expect(document2.foo).to.equal('bar');
    });

    it('can apply a simple update to an existing document', async function() {
        const document1 = {
            foo: 'bar',
        };
        const update = {
            $set: {
                foo: 'baz'
            },
        };
        const result1 = await collection.insertOne(document1);
        expect(result1.result.ok).to.equal(1);
        const result2 = await collection.updateOne({ _id: result1.insertedId }, update);
        expect(result2.result.ok).to.equal(1)
        const document3 = await collection.findOne({ _id: result1.insertedId });
        expect(document3._id).to.equal(result1.insertedId);
        expect(document3.foo).to.equal('baz');
    });

    it('can remove a document', async function() {
        const document1 = {
            foo: 'bar',
        };
        const result1 = await collection.insertOne(document1);
        expect(result1.result.ok).to.equal(1);
        const result2 = await collection.deleteOne({ _id: result1.insertedId });
        expect(result2.result.ok).to.equal(1)
        const document3 = await collection.findOne({ _id: result1.insertedId });
        expect(document3).to.be.null;
    });
});
