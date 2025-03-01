// src/mocks/idb-mock.js
export function openDB() {
    return Promise.resolve({
      transaction: () => ({
        objectStore: () => ({
          get: () => Promise.resolve(null),
          put: () => Promise.resolve(),
        }),
      }),
      close: () => {},
    });
  }
  
  export function deleteDB() {
    return Promise.resolve();
  }
  
  // Add any other functions that Firebase might be calling
  export default {
    openDB,
    deleteDB
  };