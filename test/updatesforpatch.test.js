import fs from 'fs';
import path from 'path';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { openDB, closeDB, clearCollection, checkUpdatesProduceCorrectResult } from './helpers.js';
import cloneDeep from 'lodash-es/clonedeep.js';
import updatesForPatch from '../updatesforpatch.js';

chai.use(chaiAsPromised);

describe('Updates For Patch', async function() {
    before('Set up mongo server', openDB);
    after('Close client', closeDB);
    afterEach('Clear collection', clearCollection);

    const exampleDocument = {
        'foo': 'bar',
        'baz': ['bux', 'tux'],
        'sub': { middle: { bottom: 'foo' } },
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
                { 'op': 'move', 'from': '/foo', 'path': '/baz/0' },
            ]);
            expect(documentPrior).to.deep.equal(exampleDocument);
        });

        it('should not modify the patch document passed in', async function() {
            const patch = [
                { 'op': 'move', 'from': '/foo', 'path': '/baz/0' },
            ];
            const patchPrior = cloneDeep(patch);
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, patch);
            expect(patchPrior).to.deep.equal(patch);
        });

        it('should refuse patch documents with malformed operations', async function() {
            await expect(() => updatesForPatch([
                { 'op': 'badop', 'path': '/b', 'value': 'c' },
            ], exampleDocument)).to.throw('malformed patch');
            await expect(() => updatesForPatch([
                { 'path': '/b', 'value': 'c' }, // missing op
            ], exampleDocument)).to.throw('malformed patch');
            await expect(() => updatesForPatch([
                { 'op': 'add', 'value': 'c' }, // missing path
            ], exampleDocument)).to.throw('malformed patch');
        });

        it('should refuse to apply patches where paths contain characters MongoDB does not support', async function() {
            await expect(() => updatesForPatch([
                { 'op': 'add', 'path': '/$badkey', 'value': 'x' },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { 'op': 'add', 'path': '/sub/$badkey', 'value': 'x' },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { 'op': 'add', 'path': '/sub/.key', 'value': 'x' },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { 'op': 'add', 'path': '/sub/key.subkey', 'value': 'x' },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { 'op': 'add', 'path': '/sub/key\0subkey', 'value': 'x' },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { 'op': 'add', 'path': '/\0', 'value': 'x' },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { 'op': 'add', 'path': '/', 'value': 'x' },
            ], exampleDocument)).to.throw('not MongoDB-safe');
        });

        it('should refuse to apply patches where values contain characters MongoDB does not support', async function() {
            await expect(() => updatesForPatch([
                { 'op': 'add', 'path': '/badvalue', 'value': { '$badkey1': 'value' } },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { 'op': 'add', 'path': '/badvalue', 'value': [{ '$badkey1': 'value' }] },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { 'op': 'add', 'path': '/badvalue', 'value': { 'nested': { '$badkey1': 'value' } } },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { 'op': 'add', 'path': '/badvalue', 'value': { 'nested': { '': 'value' } } },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { 'op': 'add', 'path': '/badvalue', 'value': { 'nested.key': 'value' } },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { 'op': 'add', 'path': '/badvalue', 'value': { '.key': 'value' } },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { 'op': 'add', 'path': '/badvalue', 'value': { 'key.': 'value' } },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { 'op': 'add', 'path': '/badvalue', 'value': { '.': 'value' } },
            ], exampleDocument)).to.throw('not MongoDB-safe');
            await expect(() => updatesForPatch([
                { 'op': 'add', 'path': '/badvalue', 'value': { 'foo$bar': 'value' } },
            ], exampleDocument)).to.not.throw('not MongoDB-safe');
        });
    });

    describe('Add operations', function() {
        it('should support add value operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'add', 'path': '/bar', 'value': 'mux' },
            ]); 
        });

        it('should support add value operations in a nested document', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'add', 'path': '/sub/foo', 'value': 'bar' },
            ]); 
        });

        it('should support building deep nesting through sequential operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'add', 'path': '/top', 'value': {} },
                { 'op': 'add', 'path': '/top/middle', 'value': {} },
                { 'op': 'add', 'path': '/top/middle/bottom', 'value': 'bar' },
            ]); 
        });

        it('should support building deep nesting through a single operation', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'add', 'path': '/top', 'value': { 'middle': { 'bottom': 'bar' } } },
            ]); 
        });

        it('should refuse to add to an object which does not yet exist', async function() {
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'add', 'path': '/pub/foo', 'value': 'bar' },
            ])).to.be.rejectedWith('path does not exist');
        });

        it('should support add value operations with paths that require escaping', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'add', 'path': '/~0', 'value': 'foo' },
                { 'op': 'add', 'path': '/~1', 'value': 'bar' },
            ]); 
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'add', 'path': '/~somekey', 'value': 'foo' },
            ]); 
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'add', 'path': '/~01', 'value': 'foo' },
            ]); 
        });
    });

    describe('Remove operations', function() {
        it('should support remove value operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'remove', 'path': '/foo' },
            ]); 
        });

        it('should support remove value operations on keys which start with numbers', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'remove', 'path': '/1key' },
            ]); 
        });

        it('should support removing nested objects even if modified in previous operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'replace', 'path': '/sub/middle/bottom', 'value': 'bar' },
                { 'op': 'remove', 'path': '/sub/middle/bottom' },
                { 'op': 'remove', 'path': '/sub' },
            ]); 
        });

        it('should refuse to remove from an object a field which does not exist', async function() {
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'remove', 'path': '/pub' },
            ])).to.be.rejectedWith('path does not exist');
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'remove', 'path': '/pub/foo' },
            ])).to.be.rejectedWith('path does not exist');
        });
    });

    describe('Replace operations', function() {
        it('should support replace value operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'replace', 'path': '/foo', 'value': 'baz' },
            ]); 
        });

        it('should refuse to replace a field which does not exist', async function() {
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'replace', 'path': '/notreal', 'value': 'mux' },
            ])).to.be.rejectedWith('path which does not exist');
        });
    });

    describe('Add/replace/remove operations on arrays', function() {
        it('should support add to end of array operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'add', 'path': '/baz/-', 'value': 'mux' },
            ]); 
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'add', 'path': '/baz/2', 'value': 'mux' },
            ]); 
        });

        it('should allow multiple appends to end of array', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'add', 'path': '/baz/-', 'value': 'mux' },
                { 'op': 'add', 'path': '/baz/-', 'value': 'bux' },
            ]); 
            // Also check that values which are objects are handled correctly (need to add
            // multiple values to properly exercise the update coalescing code)
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'add', 'path': '/baz/-', 'value': { key: 'mux' } },
                { 'op': 'add', 'path': '/baz/-', 'value': { key: 'bux' } },
            ]); 
        });

        it('should support insert mid-array operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'add', 'path': '/baz/0', 'value': 'mux' },
            ]); 
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'add', 'path': '/baz/1', 'value': 'mux' },
            ]);
        });

        it('should support remove mid-array operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'remove', 'path': '/baz/0' },
            ]); 
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'remove', 'path': '/baz/1' },
            ]); 
        });

        it('should support replace value mid-array operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'replace', 'path': '/baz/0', 'value': 'mux' },
            ]); 
        });

        it('should correctly handle appending to an array added by a previous replace (issue #2)', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'replace', 'path': '/baz', 'value': [] },
                { 'op': 'add', 'path': '/baz/-', 'value': 'mux' },
                { 'op': 'add', 'path': '/baz/-', 'value': 'bux' },
            ]); 
        });

        it('should allow updating multiple arrays with common paths(issue #3)', async function() {
            const nestedArrayDocument = {
                parentArray: [
                    { id: 'a', childArray: [] }
                ]
            };
            await checkUpdatesProduceCorrectResult(this.test.title, nestedArrayDocument, [
                { op: 'add', path: '/parentArray/0/childArray/0', value: { id: '1' } },
                { op: 'add', path: '/parentArray/1', value: { id: 'b' } },
            ]);
            await checkUpdatesProduceCorrectResult(this.test.title, nestedArrayDocument, [
                { op: 'add', path: '/parentArray/1', value: { id: 'b' } },
                { op: 'add', path: '/parentArray/0/childArray/0', value: { id: '1' } },
            ]);
        });
        
        it('should refuse to add to an index outside of the bounds of the array', async function() {
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'add', 'path': '/baz/-1', 'value': 'mux' },
            ])).to.be.rejectedWith('Out of bounds (lower)');
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'add', 'path': '/baz/3', 'value': 'mux' },
            ])).to.be.rejectedWith('Out of bounds (upper)');
        });

        it('should refuse to remove an index outside of the bounds of the array', async function() {
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'remove', 'path': '/baz/-1', 'value': 'mux' },
            ])).to.be.rejectedWith('Out of bounds (lower)');
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'remove', 'path': '/baz/2', 'value': 'mux' },
            ])).to.be.rejectedWith('Out of bounds (upper)');
        });

        it('should refuse to replace an index outside of the bounds of the array', async function() {
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'replace', 'path': '/baz/-1', 'value': 'mux' },
            ])).to.be.rejectedWith('path which does not exist');
            await expect(checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'replace', 'path': '/baz/2', 'value': 'mux' },
            ])).to.be.rejectedWith('path which does not exist');
        });
    });

    describe('Copy operations', function() {
        it('should support copy operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'copy', 'from': '/baz', 'path': '/maz' },
            ]); 
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'copy', 'from': '/foo', 'path': '/boo' },
            ]); 
        });

        it('should support copy operations from arrays', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'copy', 'from': '/baz/0', 'path': '/maz' },
            ]);
        });

        it('should support copy operations to arrays', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'copy', 'from': '/foo', 'path': '/baz/0' },
            ]);
        });

        it('should refuse to copy from a location which does not exist', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'copy', 'from': '/nonexistent', 'path': '/existent' },
            ], 'from does not exist');
        });
    });

    describe('Move operations', function() {
        it('should support move operations', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'move', 'from': '/baz', 'path': '/maz' },
            ]); 
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'move', 'from': '/foo', 'path': '/boo' },
            ]); 
        });

        it('should support move operations from arrays', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'move', 'from': '/baz/0', 'path': '/maz' },
            ]);
        });

        it('should support move operations to arrays', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'move', 'from': '/foo', 'path': '/baz/0' },
            ]);
        });

        it('should refuse to move from a location which does not exist', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'move', 'from': '/nonexistent', 'path': '/existent' },
            ], 'from does not exist');
        });

        it('should refuse move operations to a child of the source', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'move', 'from': '/sub', 'path': '/sub/newchild' },
            ], 'Cannot move object to a child of that object');
        });
    });

    describe('Test operations', function() {
        it('should respect test operation conditions that fail', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'test', 'path': '/foo', 'value': 'cheese' }, // should fail
                { 'op': 'replace', 'path': '/foo', 'value': 'baz' },
            ]);
        });

        it('should respect test operation conditions that succeed', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'test', 'path': '/foo', 'value': 'bar' }, // should fail
                { 'op': 'replace', 'path': '/foo', 'value': 'baz' },
            ]);
        });

        it('should respect test operation conditions on non-existent fields', async function() {
            await checkUpdatesProduceCorrectResult(this.test.title, exampleDocument, [
                { 'op': 'test', 'path': '/bar', 'value': 'cheese' }, // should fail
                { 'op': 'replace', 'path': '/foo', 'value': 'baz' },
            ]);
        });
    });

    describe('Efficiency tests', function() {
        const checkCoalescing = async (title, patch, originalDocument, expectedError, limitOnUpdateCount) => {
            await checkUpdatesProduceCorrectResult(title, originalDocument, patch, expectedError, limitOnUpdateCount);
        };

        it('should minimise updates that add/replace fields', async function() {
            await checkCoalescing(this.test.title, [
                { op: 'add', path: '/a', value: { b: 'foo' } },
                { op: 'replace', path: '/a/b', value: 'bar' },
                { op: 'replace', path: '/a/b', value: 'baz' },
                { op: 'add', path: '/c', value: { b: 'qux' } },
            ], {}, false, 1);
        });

        it('should minimise updates when adding / removing nested structure', async function() {
            await checkCoalescing(this.test.title, [
                { op: 'add', path: '/a', value: {} },
                { op: 'add', path: '/a/b', value: {} },
                { op: 'add', path: '/a/b/c', value: 'foo' },
                { op: 'replace', path: '/a/b/c', value: 'bar' },
                { op: 'replace', path: '/a', value: { x: 'baz' } },
            ], {}, false, 1);
        });

        it('should minimise updates when later operations override previous operations', async function() {
            await checkCoalescing(this.test.title, [
                { op: 'add', path: '/a/b', value: { b: 'foo' } }, // Replace just one field
                { op: 'replace', path: '/a', value: { c: 'bar' } }, // Replace the entire object
            ], { a: {} }, false, 1);
        });

        it('should minimise updates when later operations partly modify previous operations', async function() {
            await checkCoalescing(this.test.title, [
                { op: 'add', path: '/a', value: { b: 'foo' } }, // Set an entire object
                { op: 'replace', path: '/a/b', value: 'bar' }, // Replace just one field of that object
                { op: 'add', path: '/a/c', value: 'baz' }, // Replace add a different field to that object
            ], { a: {} }, false, 1);
        });

        it('should minimise updates when doing complex sequential patches', async function() {
            await checkCoalescing(this.test.title, [
                { op: 'add', path: '/a', value: 'foo' },
                { op: 'add', path: '/b', value: {} },
                { op: 'add', path: '/b/c', value: 'bar' },
                { op: 'replace', path: '/b/c', value: 'baz' }, // 1
                { op: 'move', from: '/b', path: '/c' }, // 2
                { op: 'copy', from: '/c', path: '/d' }, // 3
                { op: 'remove', path: '/c' }, // 4
            ], {}, false, 4);
        });

        it('should minimise updates when doing array appends', async function() {
            await checkCoalescing(this.test.title, [
                { op: 'add', path: '/a/-', value: 3 },
                { op: 'add', path: '/a/-', value: 4 },
                { op: 'add', path: '/a/-', value: 5 },
            ], { a: [0, 1, 2] }, false, 1);
        });

        it('should minimise updates when doing array appends to different keys', async function() {
            await checkCoalescing(this.test.title, [
                { op: 'add', path: '/a/-', value: 3 },
                { op: 'add', path: '/a/-', value: 4 },
                { op: 'add', path: '/b/-', value: 1 },
            ], { a: [0, 1, 2], b: [] }, false, 1);
        });

        it('should minimise updates when doing contiguous array inserts in reverse order', async function() {
            await checkCoalescing(this.test.title, [
                { op: 'add', path: '/a/0', value: 2 }, // 1 (reverse order)
                { op: 'add', path: '/a/0', value: 1 },
                { op: 'add', path: '/a/0', value: 0 },
            ], { a: [3, 4] }, false, 1);
        });

        it('should minimise updates when doing contiguous array inserts in forward order', async function() {
            await checkCoalescing(this.test.title, [
                { op: 'add', path: '/b/0', value: 10 }, // forward order, but different key so can be merged
                { op: 'add', path: '/b/1', value: 11 },
                { op: 'add', path: '/b/2', value: 12 },
            ], { b: [] }, false, 1);
        });

        it('should minimise updates when doing contiguous array inserts out of order', async function() {
            await checkCoalescing(this.test.title, [
                { op: 'add', path: '/a/1', value: 3 }, // 1
                { op: 'add', path: '/a/1', value: 1 },
                { op: 'add', path: '/a/2', value: 2 }, // Deliberately in between the values added by the previous two updates
            ], { a: [0, 4] }, false, 1);
        });

        it('should minimise updates when doing non-contiguous array inserts', async function() {
            await checkCoalescing(this.test.title, [
                { op: 'add', path: '/a/2', value: 4 },
                { op: 'add', path: '/a/0', value: 0 }, // Non-contiguous with first so forces a 2nd update
                { op: 'add', path: '/a/1', value: 1 },
            ], { a: [2, 3] }, false, 2);
        });

        it('should minimise updates when doing array inserts and removes', async function() {
            await checkCoalescing(this.test.title, [
                { op: 'add', path: '/a/-', value: 3 }, // 1
                { op: 'add', path: '/a/-', value: 4 }, // 1
                { op: 'remove', path: '/a/0' }, // 2+3
                { op: 'remove', path: '/a/0' }, // 4+5
                { op: 'add', path: '/b/-', value: 12 }, // 3
                { op: 'remove', path: '/b/0' }, // 6+7
                { op: 'remove', path: '/b/0' }, // 8+9
            ], { a: [0, 1, 2], b: [10, 11] }, false, 10);
        });

        it('should minimise updates that add then remove', async function() {
            await checkCoalescing(this.test.title, [
                { op: 'add', path: '/a', value: { b: 'foo' } },
                { op: 'remove', path: '/a/b' },
            ], {}, false, 1);
        });

        it('should recognise add/remove updates that cancel each other out', async function() {
            await checkCoalescing(this.test.title, [
                { op: 'add', path: '/a', value: { b: 'foo' } },
                { op: 'remove', path: '/a/b' },
                { op: 'remove', path: '/a' },
            ], {}, false, 0);
        });

        it('should minimise updates that alternate adding then removing', async function() {
            await checkCoalescing(this.test.title, [
                { op: 'add', path: '/a', value: { b: 'foo' } },
                { op: 'remove', path: '/a/b' },
                { op: 'add', path: '/c', value: { d: 'foo' } },
                { op: 'remove', path: '/c/d' },
            ], {}, false, 1);
        });

        it('should minimise updates when moving multiple things', async function() {
            await checkCoalescing(this.test.title, [
                { op: 'add', path: '/a', value: { b: 'foo' } },
                { op: 'add', path: '/d', value: { b: 'foo' } },
                { op: 'move', from: '/a', path: '/b' },
                { op: 'move', from: '/d', path: '/c' },
                { op: 'remove', path: '/c' },
            ], {}, false, 4);
        });

        it('should minimise updates when copying multiple things', async function() {
            await checkCoalescing(this.test.title, [
                { op: 'copy', from: '/a', path: '/d' },
                { op: 'copy', from: '/a/x', path: '/a/y' },
                { op: 'copy', from: '/c', path: '/a' }, // Overwrite previous value
                { op: 'copy', from: '/d', path: '/a' },
            ], { a: { x: 'foo' }, c: 'bar' }, false, 1);
        });
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

            // Not a patch issue but a JSON parsing question
            /.*duplicate ops.*/,

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
                // Not all errors in the standard test set are expected to cause throws
                const testErrorCases = [
                    'number is not equal to string',
                    'test op should fail',
                    'string not equivalent',
                ];
                const expectTestFailureNotError = (testErrorCases.indexOf(standardTest.error) >= 0);
                const hardError = expectTestFailureNotError ? undefined : standardTest.error;
                await checkUpdatesProduceCorrectResult(this.test.title, standardTest.doc, standardTest.patch, hardError);
            });
        }
    });
});

