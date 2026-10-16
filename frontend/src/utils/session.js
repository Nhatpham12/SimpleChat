// Phiên đăng nhập: "Ghi nhớ" → localStorage (còn sau khi đóng trình duyệt),
// không ghi nhớ → sessionStorage (mất khi đóng tab). Storage có thể bị trình duyệt
// chặn nên mọi thao tác đều bọc try/catch.
const KEYS = ["token", "user"];

const read = (storage, key) => {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
};

const write = (storage, key, value) => {
  try {
    storage.setItem(key, value);
  } catch {
    // ignore
  }
};

const remove = (storage, key) => {
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
};

// Kho đang giữ token (ưu tiên phiên tạm của tab hiện tại)
const activeStorage = () =>
  read(sessionStorage, "token") ? sessionStorage : localStorage;

export const getToken = () => read(sessionStorage, "token") || read(localStorage, "token");

export const saveSession = ({ token, user }, remember) => {
  clearSession();
  const storage = remember ? localStorage : sessionStorage;
  write(storage, "token", token);
  write(storage, "user", JSON.stringify(user));
};

export const updateStoredUser = (user) => {
  write(activeStorage(), "user", JSON.stringify(user));
};

export const clearSession = () => {
  KEYS.forEach((key) => {
    remove(sessionStorage, key);
    remove(localStorage, key);
  });
};
