import { artworkLibrary } from '@/lib/artwork/default-library'
import { authClient } from '@/lib/auth/client'
import { cloudSync } from '@/lib/cloud-sync/client'

export type SignOutChoice = 'remove' | 'keep'

/**
 * Signs this device out and detaches it from the account. With 'remove', garden pictures that are
 * confirmed in the account are taken off this device. Pictures not saved there yet always stay.
 */
export async function signOutOfDevice(choice: SignOutChoice) {
  await cloudSync.pause()
  try {
    const { cloudIds, blockedIds } = cloudSync.getSnapshot()
    const accountPictures =
      choice === 'remove'
        ? artworkLibrary
            .getState()
            .gallery.map((artwork) => artwork.id)
            .filter((id) => cloudIds.has(id) && !blockedIds.has(id))
        : []
    await authClient.signOut()
    cloudSync.setParent(null)
    return artworkLibrary.forgetOnDevice(accountPictures)
  } finally {
    void cloudSync.resume()
  }
}
