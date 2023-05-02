import { applyPatch } from 'rfc6902';
import cloneDeep from 'lodash.clonedeep';
import isEqual from 'lodash.isequal';
import { v4 as uuid } from 'uuid';

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

function updatesForArrayInsert(deconstructedPath, value) {
    const { parentMongoPath, fieldName, parentValue } = deconstructedPath;
    const index = parseInt(fieldName);
    if ((index < 0) || (index >= parentValue.length)) {
        throw new Error('path refers to non-existent index');
    }

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
    if (previousValue === undefined) { throw new Error('remove refers to non-existant field'); }

    return [{
        $unset: {
            [mongoPath]: true,
        }
    }];
}

function updatesToRemoveFromArray(deconstructedPath) {
    const { parentMongoPath, mongoPath, fieldName, parentValue } = deconstructedPath;
    const index = parseInt(fieldName);
    if ((index < 0) || (index >= parentValue.length)) {
        throw new Error('path refers to non-existent index');
    }

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

    return [{
        $set: {
            [mongoPath]: operation.value,
        }
    }];
}

function updatesForCopyOperation(operation, currentDocument) {
    const deconstructedToPath = deconstructPath(operation.path, currentDocument);
    const deconstructedFromPath = deconstructPath(operation.from, currentDocument);
    const { value: previousValue } = deconstructedFromPath;
    if (previousValue === undefined) { throw new Error('copy refers to from path which does not exist'); }

    // Copies are effectively 'add using the value at [from]', so we replicate the same behaviour as 'add'
    // so that if for example the target is an array, the new value is inserted rather than replaced.
    return updatesToAddValue(deconstructedToPath, previousValue);
}

function updatesForMoveOperation(operation, currentDocument) {
    const deconstructedToPath = deconstructPath(operation.path, currentDocument);
    const deconstructedFromPath = deconstructPath(operation.from, currentDocument);
    const { value: previousValue } = deconstructedFromPath;
    if (previousValue === undefined) { throw new Error('copy refers to from path which does not exist'); }

    // Copies are effectively 'add using the value at [from]', so we replicate the same behaviour as 'add'
    // so that if for example the target is an array, the new value is inserted rather than replaced.
    return [
        ...updatesToAddValue(deconstructedToPath, previousValue),
        ...updatesToRemoveValue(deconstructedFromPath),
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
        if (typeof(operation) !== 'object') { throw new Error('malformed patch operation') }

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
            throw new Error('malformed patch operation (unknown or missing op field');
        }

        applyPatch(currentDocument, [operation]); // Apply just this operation to the document to track its current state
    }
    return updates;
}
