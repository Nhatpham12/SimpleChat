// Tiện ích hiển thị nội dung tin nhắn: link, file đính kèm, ảnh Cloudinary

const URL_RE = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/gi;
// Dấu câu cuối URL thường là của câu chứ không phải của link
const TRAILING = /[.,;:!?)\]}'"]+$/;

const toHref = (url) => (url.startsWith("www.") ? `https://${url}` : url);

// Danh sách link trong 1 đoạn văn bản
export const extractLinks = (text) =>
  (text?.match(URL_RE) || []).map((raw) => raw.replace(TRAILING, "")).filter(Boolean).map(toHref);

export const linkHost = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// Văn bản → mảng node, link thành thẻ <a> bấm được
export const linkify = (text) => {
  if (!text) return text;
  const parts = [];
  let last = 0;
  text.replace(URL_RE, (match, _g, offset) => {
    const url = match.replace(TRAILING, "");
    if (offset > last) parts.push(text.slice(last, offset));
    parts.push(
      <a key={offset} href={toHref(url)} target="_blank" rel="noopener noreferrer" className="message-link">
        {url}
      </a>,
    );
    last = offset + url.length;
    return match;
  });
  if (last === 0) return text;
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

export const formatFileSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const isImage = (msg) => msg?.file_type?.startsWith("image/");
export const isVideo = (msg) => msg?.file_type?.startsWith("video/");

// Ảnh Cloudinary: thêm transformation để tải bản nhỏ vừa khung thay vì ảnh gốc
const isCloudinary = (url) => typeof url === "string" && url.includes("res.cloudinary.com");

export const imageUrl = (url, width = 640) =>
  isCloudinary(url) ? url.replace("/image/upload/", `/image/upload/c_limit,w_${width},q_auto,f_auto/`) : url;

export const thumbUrl = (msg, size = 240) => {
  const url = msg.file_url;
  if (!isCloudinary(url)) return url;
  if (isVideo(msg)) {
    return url.replace("/video/upload/", `/video/upload/so_0,c_fill,w_${size},h_${size}/`).replace(/\.\w+$/, ".jpg");
  }
  return url.replace("/image/upload/", `/image/upload/c_fill,w_${size},h_${size},q_auto,f_auto/`);
};

// Đuôi file in hoa để làm nhãn biểu tượng (PDF, DOCX...)
export const fileExt = (name) => {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name || "");
  return m ? m[1].toUpperCase() : "FILE";
};

// Một dòng tóm tắt tin nhắn cho danh sách / pop-up
export const messagePreview = (msg) => {
  if (!msg) return "";
  if (msg.is_deleted) return "Tin nhắn đã được thu hồi";
  if (msg.type === "image") return "[Hình ảnh]";
  if (msg.type === "file") return `[Tệp] ${msg.content}`;
  return msg.content;
};
