Helper module for generating a sequence of MongoDB document update operations 
that will transform a document in line with an RFC6902 JSON Patch document.
Builds on top of the [https://www.npmjs.com/package/rfc6902](rfc6902) module, 
and produces update operation documents that should work with the standard 
[https://www.npmjs.com/package/mongodb](mongodb) driver.

## Usage

NB: the following examples assume you are using the standard mongodb driver, setup for 
which is not included here.
```js
import { updatesForPatch } from 'rfc6902-mongodb';

const exampleDocument = {
    "biscuits": [
        { "name": "Digestive" },
        { "name": "Choco Leibniz" }
    ]
}

const examplePatch = [
    { "op": "add", "path": "/biscuits/1", "value": { "name": "Ginger Nut" } },
    { "op": "copy", "from": "/biscuits/0", "path": "/best_biscuit" },
    { "op": "remove", "path": "/biscuits" }
];

const insertResult = await collection.insertOne(exampleDocument);
const originalDocument = await collection.findOne({ _id: insertResult.insertedId }); // equivalent to exampleDocument
const updates = updatesForPatch(examplePatch, originalDocument);

// Apply each update in order
for await (const update of updates) {
    await collection.updateOne({ _id: insertResult.insertedId }, update);
}

```

## Caveats

The update list produced by the module presumes that the original document 
provided is an accurate copy of what is in the MongoDB collection. If the 
collection document differs, or if other updates are made to the document in 
between the updates returned by the module, then the final document will likely 
not be correct. It is the responsibility of the caller to handle any locking 
of documents or other concurrency safety logic, this module does not handle 
making atomic updates from a potentially complex patch document.

Some degree of optimisation is performed to produce a smaller set of operations.
Sometimes multiple patch operations can be easily and safely combined into a single 
DB update operation, for example when writing new values into unrelated fields.
Other patch operations like `remove` or operations on arrays can affect subsequent 
operations, by changing the values referred to by operation paths. Unless it is 
unambiguously safe to coalesce operations together, this implementation will err 
on the side of correctness: more distinct operations but that are guaranteed to 
produce the correct final result.
 