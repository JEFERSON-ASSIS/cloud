export type FileBreadcrumb = { id: string; name: string };

export type FilesNavigationState = {
  folderId: string | null;
  sharedView: boolean;
  trash: boolean;
};

export function resolveFilesBackTarget(
  state: FilesNavigationState & { breadcrumbs: FileBreadcrumb[] },
): FilesNavigationState | null {
  if (state.folderId) {
    const parent = state.breadcrumbs.at(-2);
    return {
      folderId: parent && parent.id !== "__shared__" ? parent.id : null,
      sharedView: state.sharedView,
      trash: false,
    };
  }

  if (state.sharedView || state.trash) {
    return { folderId: null, sharedView: false, trash: false };
  }

  return null;
}
