let currentPageAccess = {
  pathname: "",
  loading: true,
  matched: false,
  isAdmin: false,
  canView: false,
  canCreate: false,
};

const pendingReaders = new Set();

function normalizePathname(pathname) {
  const value = String(pathname ?? "").trim().replace(/\/+$/, "");
  return value.startsWith("/") ? value : "";
}

export function publishPageAccess(pathname, access) {
  currentPageAccess = {
    pathname: normalizePathname(pathname),
    loading: Boolean(access?.loading),
    matched: Boolean(access?.matched),
    isAdmin: Boolean(access?.isAdmin),
    canView: Boolean(access?.canView),
    canCreate: Boolean(access?.canCreate),
  };

  if (currentPageAccess.loading) return;

  for (const reader of pendingReaders) {
    if (reader.pathname === currentPageAccess.pathname) {
      pendingReaders.delete(reader);
      reader.resolve(currentPageAccess);
    }
  }
}

export function waitForPageAccess(pathname, timeoutMs = 3000) {
  const normalizedPathname = normalizePathname(pathname);

  if (
    currentPageAccess.pathname === normalizedPathname &&
    !currentPageAccess.loading
  ) {
    return Promise.resolve(currentPageAccess);
  }

  return new Promise((resolve) => {
    let timeout;
    const reader = {
      pathname: normalizedPathname,
      resolve: (access) => {
        if (timeout) clearTimeout(timeout);
        resolve(access);
      },
    };

    timeout = setTimeout(() => {
      pendingReaders.delete(reader);
      resolve(null);
    }, timeoutMs);

    pendingReaders.add(reader);
  });
}
