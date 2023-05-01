import { expect } from 'chai';
import mongodb from 'mongo-mock';
const { MongoClient } = mongodb;
mongodb.max_delay = 0; // choose to NOT pretend wait for async operations

// Connection URL
const dbURL = 'mongodb://localhost:27017/test';
// Use connect method to connect to the Server


// Test of the test rig (does not exercise module code)
describe('Test that mongodb updates can be performed', async function() {
    let client;
    let db;
    let collection;
    before('Set up mongo server', async function() {
        client = await MongoClient.connect(dbURL, {});
        expect(client).to.not.be.null;
        db = client.db();
        collection = db.collection('documents');
    });
    after('Close client', async function() {
        db.close();
        client.close();
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
