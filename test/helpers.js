import { expect } from 'chai';
import mongodb from 'mongo-mock';

import { applyPatch } from 'rfc6902';

import { updatesForPatch } from '../index.js'; // module under test
import cloneDeep from 'lodash.clonedeep';

const { MongoClient } = mongodb;
mongodb.max_delay = 0; // choose to NOT pretend wait for async operations

// Connection URL
const dbURL = 'mongodb://localhost:27017/test';

let client, db, collection;
export async function openDB() {
    expect(client, 'double call to openDB without corresponding closeDB').to.be.undefined;
    client = await MongoClient.connect(dbURL, {});
    expect(client).to.not.be.null;
    db = client.db();
    collection = db.collection('documents');
    return { client, db, collection };
}

export async function closeDB() {
    await db.close();
    await client.close();
    client = undefined;
    db = undefined;
    collection = undefined;
}

export async function clearCollection() {
    await collection.deleteMany({});
}

export async function applyPatchUpdates(query, updates) {
    for await (const update of updates) {
        const updateResult = await collection.updateOne(query, update);
        expect(updateResult.result.ok).to.equal(1);
    }
}

export async function checkUpdatesProduceCorrectResult(message, originalDocument, patch) {
    const insertResult = await collection.insertOne(originalDocument);
    expect(insertResult.result.ok).to.equal(1);
    const query = { _id: insertResult.insertedId };

    const updates = updatesForPatch(patch);
    expect(updates).to.be.a('array');
    await applyPatchUpdates(query, updates);

    const finalDocument = await collection.findOne(query);
    delete finalDocument._id;

    const referenceDocument = cloneDeep(originalDocument);
    applyPatch(referenceDocument, patch);
    expect(finalDocument, message).to.deep.equal(referenceDocument);
    return finalDocument;
}
