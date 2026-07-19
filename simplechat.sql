-- =====================================================================
-- SCRIPT TẠO DATABASE CHO ỨNG DỤNG CHAT
-- =====================================================================

CREATE DATABASE IF NOT EXISTS SimpleChat
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE SimpleChat;

-- ---------------------------------------------------------------------
-- Bảng 1: Users
-- ---------------------------------------------------------------------
CREATE TABLE Users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50) NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    avatar_url    TEXT DEFAULT NULL,
    status        ENUM('online','offline','away') DEFAULT 'offline',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Bảng 2: Conversations
-- ---------------------------------------------------------------------
CREATE TABLE Conversations (
    conversation_id   INT AUTO_INCREMENT PRIMARY KEY,
    type              ENUM('direct','group') NOT NULL,
    conversation_name VARCHAR(100) DEFAULT NULL,
    avatar_url        TEXT DEFAULT NULL,
    created_by        INT DEFAULT NULL,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES Users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Bảng 3: Participants (Conversation Members)
-- ---------------------------------------------------------------------
CREATE TABLE Participants (
    participant_id  INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    user_id         INT NOT NULL,
    role            ENUM('admin','member') DEFAULT 'member',
    joined_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES Conversations(conversation_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    UNIQUE KEY uq_participants (conversation_id, user_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Bảng 4: Messages
-- ---------------------------------------------------------------------
CREATE TABLE Messages (
    message_id      INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender_id       INT NOT NULL,
    content         TEXT NOT NULL,
    type            ENUM('text','image','file','system') DEFAULT 'text',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NULL DEFAULT NULL,
    is_deleted      BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (conversation_id) REFERENCES Conversations(conversation_id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Bảng 5: Attachments
-- ---------------------------------------------------------------------
CREATE TABLE Attachments (
    attachment_id INT AUTO_INCREMENT PRIMARY KEY,
    message_id    INT NOT NULL,
    file_url      TEXT NOT NULL,
    file_type     VARCHAR(50) DEFAULT NULL,
    file_size     INT DEFAULT NULL,
    uploaded_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES Messages(message_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Bảng 6: MessageStatus (đọc/đã gửi/đã nhận)
-- ---------------------------------------------------------------------
CREATE TABLE MessageStatus (
    status_id   INT AUTO_INCREMENT PRIMARY KEY,
    message_id  INT NOT NULL,
    receiver_id INT NOT NULL,
    status      ENUM('sent','delivered','read') DEFAULT 'sent',
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES Messages(message_id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    UNIQUE KEY uq_messagestatus (message_id, receiver_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Bảng 7: UserContacts (bạn bè)
-- ---------------------------------------------------------------------
CREATE TABLE UserContacts (
    contact_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    friend_id  INT NOT NULL,
    status     ENUM('pending','accepted','blocked') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    UNIQUE KEY uq_usercontacts (user_id, friend_id),
    CHECK (user_id <> friend_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Bảng 8: Notifications
-- ---------------------------------------------------------------------
CREATE TABLE Notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    type            VARCHAR(50) NOT NULL,
    content         TEXT DEFAULT NULL,
    reference_id    INT DEFAULT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_seen         BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Bảng 9: BlockedUsers
-- ---------------------------------------------------------------------
CREATE TABLE BlockedUsers (
    block_id        INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    blocked_user_id INT NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    UNIQUE KEY uq_blockedusers (user_id, blocked_user_id),
    CHECK (user_id <> blocked_user_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Bảng 10: GroupSettings
-- ---------------------------------------------------------------------
CREATE TABLE GroupSettings (
    setting_id      INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    setting_name    VARCHAR(50) NOT NULL,
    setting_value   TEXT DEFAULT NULL,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES Conversations(conversation_id) ON DELETE CASCADE,
    UNIQUE KEY uq_groupsettings (conversation_id, setting_name)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Bảng 11: EmailVerifications (xác minh email khi đăng ký)
-- ---------------------------------------------------------------------
CREATE TABLE EmailVerifications (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    token      VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_used    BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Bảng 12: PasswordResets (đặt lại mật khẩu qua email)
-- ---------------------------------------------------------------------
CREATE TABLE PasswordResets (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    user_id    INT NOT NULL,
    token      VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_used    BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
-- INDEXING
-- =====================================================================

-- Users
CREATE INDEX idx_users_created_at ON Users(created_at);

-- Conversations
CREATE INDEX idx_conversations_created_at ON Conversations(created_at);

-- Messages
CREATE INDEX idx_messages_conversation_id ON Messages(conversation_id);
CREATE INDEX idx_messages_sender_id ON Messages(sender_id);
CREATE INDEX idx_messages_created_at ON Messages(created_at);
CREATE INDEX idx_messages_conv_created ON Messages(conversation_id, created_at);

-- Participants
CREATE INDEX idx_participants_conversation_id ON Participants(conversation_id);
CREATE INDEX idx_participants_user_id ON Participants(user_id);

-- Attachments
CREATE INDEX idx_attachments_message_id ON Attachments(message_id);

-- MessageStatus
CREATE INDEX idx_messagestatus_message_id ON MessageStatus(message_id);
CREATE INDEX idx_messagestatus_receiver_id ON MessageStatus(receiver_id);

-- UserContacts
CREATE INDEX idx_usercontacts_user_id ON UserContacts(user_id);
CREATE INDEX idx_usercontacts_friend_id ON UserContacts(friend_id);

-- Notifications
CREATE INDEX idx_notifications_user_id ON Notifications(user_id);
CREATE INDEX idx_notifications_created_at ON Notifications(created_at);

-- BlockedUsers
CREATE INDEX idx_blockedusers_user_id ON BlockedUsers(user_id);
CREATE INDEX idx_blockedusers_blocked_user_id ON BlockedUsers(blocked_user_id);

-- GroupSettings
CREATE INDEX idx_groupsettings_conversation_id ON GroupSettings(conversation_id);

-- EmailVerifications
CREATE INDEX idx_emailverifications_user_id ON EmailVerifications(user_id);

-- PasswordResets
CREATE INDEX idx_passwordresets_user_id ON PasswordResets(user_id);
