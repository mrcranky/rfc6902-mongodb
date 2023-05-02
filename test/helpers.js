import { expect } from 'chai';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongodb from 'mongodb';

import { applyPatch } from 'rfc6902';

import { updatesForPatch } from '../index.js'; // module under test
import cloneDeep from 'lodash.clonedeep';

const { MongoClient } = mongodb;

let mongod;
let client, db, collection;
export async function openDB() {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    expect(client, 'double call to openDB without corresponding closeDB').to.be.undefined;
    client = await MongoClient.connect(uri, {});
    expect(client).to.not.be.null;
    db = client.db();
    collection = db.collection('documents');
    return { mongod, client, db, collection };
}

export async function closeDB() {
    await client.close();
    client = undefined;
    db = undefined;
    collection = undefined;
    await mongod.stop();
    mongod = undefined;
}

export async function clearCollection() {
    await collection.deleteMany({});
}

export async function applyPatchUpdates(query, updates) {
    for (const update of updates) {
        const updateResult = await collection.updateOne(query, update);
        expect(updateResult.acknowledged).to.be.true;
    }
}

export async function checkUpdatesProduceCorrectResult(message, originalDocument, patch) {
    const insertResult = await collection.insertOne({ ...originalDocument }); // Deliberately clone to avoid the parameter being modified by the insert
    expect(insertResult.acknowledged).to.be.true;
    const query = { _id: insertResult.insertedId };

    const updates = updatesForPatch(patch, originalDocument);
    expect(updates).to.be.a('array');
    await applyPatchUpdates(query, updates);

    const finalDocument = await collection.findOne(query);
    delete finalDocument._id;

    const referenceDocument = cloneDeep(originalDocument);
    const patchResults = applyPatch(referenceDocument, patch);
    const testErrors = patchResults.filter(result => {
        return result?.name === 'TestError';
    });
    if (testErrors.length > 0) {
        // Patch fails tests, so should not be applied.
        // NB: despite the spec, rfc6902 will have modified referenceDocument even though one of the tests fail
        expect(updates).to.have.length(0);
    } else {
        expect(finalDocument, message).to.deep.equal(referenceDocument);
    }
    return finalDocument;
}
