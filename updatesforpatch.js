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
    return [];
}
