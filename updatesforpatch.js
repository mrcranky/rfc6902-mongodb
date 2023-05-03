import { applyPatch } from 'rfc6902';
import cloneDeep from 'lodash.clonedeep';
import lodashSet from 'lodash.set';
import lodashUnset from 'lodash.unset';
import isEqual from 'lodash.isequal';
import { v4 as uuid } from 'uuid';

function keyIsMongoSafe(key) {
    if (key.startsWith('$')) { return false; }
    if (key.includes('\0')) { return false; }
    if (key.includes('.')) { return false; }
    if (key === '') { return false; }
    return true;
}

function documentIsMongoSafe(document) {
    if (typeof(document) === 'object') {
        for (const key in document) {
            if (!keyIsMongoSafe(key)) { return false; }
            if (!documentIsMongoSafe(document[key])) { return false; } // Recurse to child values
        }
    }
    return true;
}

function getValue(document, pathElements) {
    if (pathElements.length === 0) { return document; }
    const remainingPathElements = [...pathElements]; //Deliberately clone so the caller isn't affected
    const field = remainingPathElements.shift();
    const parentValue = document[field];
    if (parentValue) {
        return getValue(parentValue, remainingPathElements);
    } else {
        return undefined; // path does not exist to recurse to
    }
}

function deconstructPath(patchPath, document) {
    if (!patchPath || !patchPath.startsWith('/')) {
        throw new Error('invalid path for operation');
    }

    const pathElements = patchPath.split('/'); 
    pathElements.shift(); // Remove the empty path element produced by the leading slash
    const fieldName = pathElements.pop();
    if (!keyIsMongoSafe(fieldName)) {
        throw new Error('path is not MongoDB-safe (invalid characters)');
    }
    // Now pathElements will contain the path of the parent of the value being operated on

    const parentValue = getValue(document, pathElements);
    if (!parentValue) {
        throw new Error('path does not exist');
    }
    let value;
    if (fieldName === '-') {
        // Path deliberately refers to a value we know doesn't already exist
        value = undefined;
    } else if (typeof(parentValue) === 'object') {
        // Try and look up the field's value in the parent (might be an array or an object)
        value = parentValue[fieldName];
    }
    const parentMongoPath = pathElements.join('.');
    const mongoPath = [...pathElements, fieldName].join('.');
    return {
        fieldName,
        value,
        parentValue,
        parentMongoPath,
        mongoPath,
    };
}

function pathRefersToArrayChild(deconstructedPath) {
    const { parentValue } = deconstructedPath;
    return Array.isArray(parentValue);
}

function pathRefersToEndOfArray(deconstructedPath) {
    const { parentValue, fieldName } = deconstructedPath;
    return Array.isArray(parentValue) && (fieldName === '-');
}

function updatesForAddOperation(operation, currentDocument) {
    const deconstructedPath = deconstructPath(operation.path, currentDocument);
    return updatesToAddValue(deconstructedPath, operation.value);
}

function updatesToAddValue(deconstructedPath, value) {
    if (!documentIsMongoSafe(value)) {
        throw new Error('Value being set is not MongoDB-safe (invalid characters)');
    }

    if (pathRefersToArrayChild(deconstructedPath)) {
        if (pathRefersToEndOfArray(deconstructedPath)) {
            return updatesForArrayAppend(deconstructedPath, value);
        } else {
            return updatesForArrayInsert(deconstructedPath, value);
        }
    } else {
        return updatesForFieldAdd(deconstructedPath, value);
    }
}

function updatesForFieldAdd(deconstructedPath, value) {
    const { mongoPath } = deconstructedPath;

    return [{
        $set: {
            [mongoPath]: value,
        }
    }];
}

function updatesForArrayAppend(deconstructedPath, value) {
    const { parentMongoPath } = deconstructedPath;

    return [{
        $push: {
            [parentMongoPath]: value,
        }
    }];
}

function checkArrayIndex(parentValue, index, allowOneBeyond) {
    if (index < 0) { 
        throw new Error('Out of bounds (lower)');
    }
    //NB: For adds, we're allowed to target one beyond the end of the array (an append), but not two beyond
    const limit = parentValue.length + (allowOneBeyond ? 1 : 0);
    if (index >= limit) { 
        throw new Error('Out of bounds (upper)');
    }
}

function updatesForArrayInsert(deconstructedPath, value) {
    const { parentMongoPath, fieldName, parentValue } = deconstructedPath;
    const index = parseInt(fieldName);
    checkArrayIndex(parentValue, index, true); // Allow targeting one beyond the end

    return [{
        $push: {
            [parentMongoPath]: {
                $each: [value],
                $position: index,
            },
        }
    }];
}

function updatesForRemoveOperation(operation, currentDocument) {
    const deconstructedPath = deconstructPath(operation.path, currentDocument);
    return updatesToRemoveValue(deconstructedPath);
}

function updatesToRemoveValue(deconstructedPath) {
    if (pathRefersToArrayChild(deconstructedPath)) {
        return updatesToRemoveFromArray(deconstructedPath);
    } else {
        return updatesToRemoveField(deconstructedPath);
    }
}

function updatesToRemoveField(deconstructedPath) {
    const { value: previousValue, mongoPath } = deconstructedPath;
    if (previousValue === undefined) { throw new Error('path does not exist'); }

    return [{
        $unset: {
            [mongoPath]: true,
        }
    }];
}

function updatesToRemoveFromArray(deconstructedPath) {
    const { parentMongoPath, mongoPath, fieldName, parentValue } = deconstructedPath;
    const index = parseInt(fieldName);
    checkArrayIndex(parentValue, index, false); // Strictly limit to targeting items within bounds

    // MongoDB does not currently support an easy removal of an item from within an 
    // array by index, only by value.
    // We kludge around this by setting the array item to a unique value and then 
    // pulling that value out in a separate operation
    const uniqueValue = uuid();
    return [
        { $set: { [mongoPath]: uniqueValue } },
        { $pull: { [parentMongoPath]: uniqueValue } },
    ];
}

function updatesForReplaceOperation(operation, currentDocument) {
    const deconstructedPath = deconstructPath(operation.path, currentDocument);
    const { value: previousValue, mongoPath } = deconstructedPath;
    if (previousValue === undefined) { throw new Error('replace refers to path which does not exist (use add)'); }

    if (!documentIsMongoSafe(operation.value)) {
        throw new Error('Value being set is not MongoDB-safe (invalid characters)');
    }

    return [{
        $set: {
            [mongoPath]: operation.value,
        }
    }];
}

function updatesForCopyOperation(operation, currentDocument) {
    const deconstructedToPath = deconstructPath(operation.path, currentDocument);
    const deconstructedFromPath = deconstructPath(operation.from, currentDocument);
    if (deconstructedFromPath.mongoPath === deconstructedToPath.mongoPath) {
        return []; // No-op, copy to self
    }

    const { value: previousValue } = deconstructedFromPath;
    if (previousValue === undefined) { throw new Error('copy refers to from path which does not exist'); }

    if (!documentIsMongoSafe(previousValue)) {
        throw new Error('Value being copied is not MongoDB-safe (invalid characters)');
    }

    // Copies are effectively 'add using the value at [from]', so we replicate the same behaviour as 'add'
    // so that if for example the target is an array, the new value is inserted rather than replaced.
    return updatesToAddValue(deconstructedToPath, cloneDeep(previousValue));
}

function updatesForMoveOperation(operation, currentDocument) {
    const deconstructedToPath = deconstructPath(operation.path, currentDocument);
    const deconstructedFromPath = deconstructPath(operation.from, currentDocument);
    if (deconstructedFromPath.mongoPath === deconstructedToPath.mongoPath) {
        return []; // No-op, move to self
    }

    const { value: previousValue } = deconstructedFromPath;
    if (previousValue === undefined) { throw new Error('copy refers to from path which does not exist'); }
    if (!documentIsMongoSafe(previousValue)) {
        throw new Error('Value being moved is not MongoDB-safe (invalid characters)');
    }

    // Copies are effectively 'add using the value at [from]', so we replicate the same behaviour as 'add'
    // so that if for example the target is an array, the new value is inserted rather than replaced.
    return [
        ...updatesToRemoveValue(deconstructedFromPath),
        ...updatesToAddValue(deconstructedToPath, previousValue),
    ];
}

function passesTestOperation(operation, currentDocument) {
    if (operation.path) {
        const deconstructedPath = deconstructPath(operation.path, currentDocument);
        const { value } = deconstructedPath;

        return isEqual(value, operation.value);
    } else {
        // testing the whole document
        return isEqual(operation.value, currentDocument);
    }
}

function findRelatedUpdates(path, updateDocument) {
    for (const key in (updateDocument || {})) {
        if (path.startsWith(`${key}.`)) {
            return { parentKey: key }; // a key exists which is a parent of the path we care about 
        }
        if (key.startsWith(`${path}.`)) {
            return { childKey: key }; // a key exists which is a child of the path we care about 
        }
    }
    return {};
}

function combineSetAndUnsetUpdates(a, b) {
    const update = cloneDeep(a);
    if (!update.$set) { update.$set = {}; }
    if (!update.$unset) { update.$unset = {}; }

    for (const keyB in b.$set) {
        const valueB = b.$set[keyB];
        const { childKey: childKeyBeingWrittenTo, parentKey: parentKeyBeingWrittenTo } = findRelatedUpdates(keyB, update.$set);
        const { childKey: childKeyBeingRemoved, parentKey: parentKeyBeingRemoved } = findRelatedUpdates(keyB, update.$unset);
        if (parentKeyBeingRemoved) {
            // We can't combine the removal with a new write, must leave unmerged so that the removal completes first
            return [a, b];
        }
        if (childKeyBeingRemoved) {
            // A part of the object was going to be removed, but now we are replacing a parent so that removal is
            // irrelevant
            delete update.$unset[childKeyBeingRemoved];
        }
        if (childKeyBeingWrittenTo) {
            // The old write to the child is no longer relevant, it has been superceded by the write to the parent
            delete update.$set[childKeyBeingWrittenTo]; 
        }

        if (parentKeyBeingWrittenTo) {
            // A previous write to the parent value is now getting an update to one of its sub-values
            const write = update.$set[parentKeyBeingWrittenTo];
            const subPath = keyB.slice(parentKeyBeingWrittenTo.length + 1); // Ignore the part of the path the updates share
            // Alter the value being written in a, to add (or replace) the value being written in b
            lodashSet(write, subPath, valueB);
        } else {
            // The write doesn't partially overlap with any other pre-existing writes, so can just be added
            // If the key has already been written in a previous update, this will replace the previous write
            // entirely
            update.$set[keyB] = valueB;
        }
    }

    for (const keyB in b.$unset) {
        const valueB = b.$unset[keyB];
        const { childKey: childKeyBeingWrittenTo, parentKey: parentKeyBeingWrittenTo } = findRelatedUpdates(keyB, update.$set);
        const { childKey: childKeyBeingRemoved, parentKey: parentKeyBeingRemoved } = findRelatedUpdates(keyB, update.$unset);
        if (parentKeyBeingRemoved) {
            throw new Error('Somehow deleting a child of a sub-document that was already removed');
        }
        if (childKeyBeingRemoved) {
            // This remove supersedes the previous removal, so drop it
            delete update.$unset[childKeyBeingRemoved];
        }
        if (childKeyBeingWrittenTo) {
            // The remove renders a previous write to a child value irrelevant
            delete update.$set[childKeyBeingWrittenTo];
        }
        if (update.$set[keyB]) {
            // The whole key that is being removed was previously written, so that write is now irrelevant
            delete update.$set[keyB];
        }

        if (parentKeyBeingWrittenTo) {
            // We're now removing part of a previously written larger object
            const write = update.$set[parentKeyBeingWrittenTo];
            const subPath = keyB.slice(parentKeyBeingWrittenTo.length + 1); // Ignore the part of the path the updates share
            // Scrub the portion of the parent object that is now being removed
            lodashUnset(write, subPath);
        } else {
            // Include the removal in the merged update
            update.$unset[keyB] = valueB;
        }
    }

    // Clean up in case the merge left us with no more updates of a particular type
    if (update.$set && Object.keys(update.$set).length === 0) { delete update.$set; }
    if (update.$unset && Object.keys(update.$unset).length === 0) { delete update.$unset; }

    if (update.$set || update.$unset) {
        return [update];
    } else {
        return []; // Merged updates have cancelled each other out
    }
}

function isAppend(pushUpdate) {
    if (typeof(pushUpdate) === 'object') {
        if (pushUpdate.$position !==  undefined) {
            return { append: false, items: pushUpdate.$each };
        } else {
            return { append: true, items: pushUpdate.$each };
        }
    } else {
        return { append: true, items: [pushUpdate] };
    }
}

function combineArrayUpdates(a, b) {
    const update = cloneDeep(a);
    for (const keyB in b.$push) {
        const writeB = b.$push[keyB];
        const writeA = update.$push[keyB];
        if (writeA && writeB) {
            // Writing to an array we've already written to, still might be able to combine,
            // if the new write is contiguous with the old
            const appendA = isAppend(writeA);
            const appendB = isAppend(writeB);
            if (appendA.append && appendB.append) {
                // Appends are naturally contiguous
                update.$push[keyB] = {
                    $each: [
                        ...appendA.items,
                        ...appendB.items,
                    ]
                };
            } else {
                // Inserts might still be contiguous
                const startIndex = writeA.$position;
                const endIndex = startIndex + writeA.$each.length;
                if (writeB.$position === endIndex) {
                    // B is being inserted at the index just after the items added by A
                    update.$push[keyB] = {
                        $each: [
                            ...appendA.items,
                            ...appendB.items,
                        ],
                        $position: startIndex,
                    };
                } else if (writeB.$position === startIndex) {
                    // B is being inserted at the same index as A (i.e. just before all the items added by A)
                    update.$push[keyB] = {
                        $each: [
                            ...appendB.items,
                            ...appendA.items,
                        ],
                        $position: startIndex,
                    };
                } else if ((writeB.$position > startIndex) && (writeB.$position < endIndex)) {
                    const items = [...appendA.items];
                    const relativePosition = writeB.$position - startIndex;
                    items.splice(relativePosition, 0, ...appendB.items); // insert B's items at the appropriate position within A's items
                    update.$push[keyB] = {
                        $position: startIndex,
                        $each: items,
                    };
                } else {
                    return [a, b]; // Can't combine
                }
            }
        } else {
            // Writing to unrelated arrays, just do both
            update.$push[keyB] = writeB;
        }
    }
    return [update];
}

function combineUpdates(a, b) {
    if (!a) { return [b]; } // When there is no previous update to combine with

    if ((a.$set || a.$unset) && (b.$set || b.$unset)) {
        return combineSetAndUnsetUpdates(a, b);
    }
    if (a.$push && b.$push) {
        return combineArrayUpdates(a, b);
    }

    // Default case is to simply return both updates without combining them
    return [a, b];
}

// NB: We only compact contiguous updates/operations. For patches which are 
// dominated by add/replace operations, this gets rid of the worst inefficiency: 
// multiple $sets which could be all done in one DB update.
// Remove operations are slightly easier to analyse for safety, because you can tell
// if a remove is operating on a sub-document of a path in a previous operation.
// Array replace or insert updates have knock-on effects (because they change the 
// values pointed to by subsequent indexes) which are much harder to deem "safe",
// but array append operations, or array inserts which are contiguous, result in 
// $push operations which can be safely combined.
// A more aggressive algorithm here could identify intervening updates which are 
// unrelated, and choose to combine an update with an earlier operation as long 
// as none of the intervening updates affect the same area of the document. E.g.:
// * Add /b as { c: { d: 0 } }
// * Remove /a
// * Add /b/c/e as 1
// The third operation could be safely folded into the first operation, because the
// second operation affects the /a subdocument, and the others affect /b 
// However this comes with the downside that the order of operations in the patch
// no longer matches the order of changes to the document, which may catch users 
// out if they are making assumptions about the document's state mid-update.
function compactUpdates(updates) {
    const compacted = [];
    for (const update of updates) {
        const previousUpdate = compacted.pop();
        const compactedUpdates = combineUpdates(previousUpdate, update);
        compacted.push(...compactedUpdates);
    }
    return compacted;
}

/** @returns Array of MongoDB update statements that, if applied 
 * in order, will transform the original document in the manner
 * described by the patch document.
 * Assumes that originalDocument accurately describes the existing 
 * document in the collection, and that no other updates are made to
 * the document in the interim.
 * If the patch should not be applied because the original document fails a test 
 * operation, an empty array will be returned.
 * If the patch cannot be applied because errors were detected (for 
 * example trying to perform a replace operation on a field which does not
 * exist), an Error will be thrown detailing the operation which failed
 */
export default function updatesForPatch(patch, originalDocument) {
    if (!Array.isArray(patch)) { throw new Error('malformed patch document (not an array)'); }
    if (!originalDocument) { throw new Error('malformed original document'); }

    const updates = [];
    const currentDocument = cloneDeep(originalDocument);
    for (const operation of patch) {
        if (typeof(operation) !== 'object') { throw new Error('malformed patch operation (not an object)'); }
        if (operation.path === undefined) { throw new Error ('malformed patch operation (no path)'); }

        if (operation.op === 'add') {
            updates.push(...updatesForAddOperation(operation, currentDocument));
        } else if (operation.op === 'remove') {
            updates.push(...updatesForRemoveOperation(operation, currentDocument));
        } else if (operation.op === 'replace') {
            updates.push(...updatesForReplaceOperation(operation, currentDocument));
        } else if (operation.op === 'copy') {
            updates.push(...updatesForCopyOperation(operation, currentDocument));
        } else if (operation.op === 'move') {
            updates.push(...updatesForMoveOperation(operation, currentDocument));
        } else if (operation.op === 'test') {
            if (!passesTestOperation(operation, currentDocument)) {
                return []; // Failed test, whole patch should not be applied
            }
        } else {
            throw new Error('malformed patch operation (unknown or missing op field)');
        }

        applyPatch(currentDocument, [operation]); // Apply just this operation to the document to track its current state
    }
    
    return compactUpdates(updates);
}
