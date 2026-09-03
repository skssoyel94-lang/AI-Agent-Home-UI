import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/expo';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Redirect, type Href } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useListWorkspaceFiles } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { useFirebaseAuth } from '@/components/FirebaseAuthProvider';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachment?: ChatAttachment;
};

type ChatAttachment = {
  name: string;
  uri: string;
  mimeType?: string;
  size?: number;
};

type Model = {
  id: string;
  name: string;
  detail: string;
};

type WorkspaceTool = {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  detail: string;
  description: string;
};

type WorkspaceFile = {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
};

const models: Model[] = [
  { id: 'groq', name: 'Groq', detail: 'Llama 3 / Mixtral' },
  { id: 'gemini', name: 'Gemini', detail: 'Google AI' },
  { id: 'ollama', name: 'Ollama', detail: 'Local models' },
  { id: 'kimi', name: 'Kimi', detail: 'Long context' },
];

const workspaceTools: WorkspaceTool[] = [
  {
    icon: 'package',
    label: 'Packages',
    detail: 'Auto',
    description: 'Manage the packages available to this workspace.',
  },
  {
    icon: 'database',
    label: 'PostgreSQL',
    detail: 'Database',
    description: 'Connect persistent PostgreSQL data to your workspace.',
  },
  {
    icon: 'cloud',
    label: 'Deploy',
    detail: 'Publish',
    description: 'Prepare this workspace to publish when your build is ready.',
  },
  {
    icon: 'github',
    label: 'Import from GitHub',
    detail: 'Repository',
    description: 'Bring a GitHub repository into this workspace.',
  },
  {
    icon: 'github',
    label: 'GitHub Push',
    detail: 'Sync',
    description: 'Send workspace changes back to a connected GitHub repository.',
  },
  {
    icon: 'terminal',
    label: 'Terminal',
    detail: 'Commands',
    description: 'Run workspace commands and inspect their output.',
  },
  {
    icon: 'monitor',
    label: 'Live preview',
    detail: 'Running',
    description: 'Open the running preview of the app you are building.',
  },
];

function makeId(): string {
  return `${Date.now().toString()}-${Math.random().toString(36).slice(2, 9)}`;
}

function attachmentIcon(attachment: ChatAttachment): React.ComponentProps<typeof Feather>['name'] {
  const name = attachment.name.toLowerCase();
  if (attachment.mimeType?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(name)) {
    return 'image';
  }
  if (attachment.mimeType?.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/.test(name)) {
    return 'video';
  }
  if (/\.(zip|rar|7z|tar|gz)$/.test(name)) return 'archive';
  return 'file';
}

function formatFileSize(size?: number): string {
  if (size === undefined) return 'File';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function IconButton({
  icon,
  onPress,
  colors,
  accessibilityLabel,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        { backgroundColor: colors.secondary },
        pressed && styles.pressed,
      ]}
    >
      <Feather name={icon} size={20} color={colors.foreground} />
    </Pressable>
  );
}

function MessageBubble({
  message,
  colors,
}: {
  message: Message;
  colors: ReturnType<typeof useColors>;
}) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.messageRow, isUser && styles.userMessageRow]}>
      {!isUser && (
        <View style={styles.assistantAvatar}>
          <Ionicons name="sparkles" size={16} color={colors.primary} />
        </View>
      )}
      <View
        style={[
          styles.messageBubble,
          isUser
            ? { backgroundColor: colors.secondary }
            : { backgroundColor: colors.card },
        ]}
      >
        {message.attachment && (
          <View style={[styles.attachmentCard, { backgroundColor: colors.background }]}>
            <View style={[styles.attachmentIcon, { backgroundColor: colors.secondary }]}>
              <Feather
                name={attachmentIcon(message.attachment)}
                size={16}
                color={colors.primary}
              />
            </View>
            <View style={styles.attachmentCopy}>
              <Text style={[styles.attachmentName, { color: colors.foreground }]} numberOfLines={1}>
                {message.attachment.name}
              </Text>
              <Text style={[styles.attachmentSize, { color: colors.mutedForeground }]}>
                {formatFileSize(message.attachment.size)}
              </Text>
            </View>
          </View>
        )}
        <Text style={[styles.messageText, { color: colors.foreground }]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

function HomeOverview({
  colors,
}: {
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={styles.websiteHome}>
      <View style={styles.heroMark}>
        <Ionicons name="sparkles" size={26} color={colors.primary} />
      </View>
      <Text style={[styles.greeting, { color: colors.foreground }]}>
        Hi Sk, let&apos;s get into it
      </Text>
    </View>
  );
}

function Sheet({
  visible,
  onClose,
  colors,
  onNewChat,
  onTasks,
  onMemory,
  onTool,
  files,
  filesLoading,
  filesError,
  onRetryFiles,
  onFile,
}: {
  visible: boolean;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
  onNewChat: () => void;
  onTasks: () => void;
  onMemory: () => void;
  onTool: (tool: WorkspaceTool) => void;
  files: WorkspaceFile[];
  filesLoading: boolean;
  filesError: boolean;
  onRetryFiles: () => void;
  onFile: (file: WorkspaceFile) => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.drawerBackdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.drawer,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          <ScrollView
            contentContainerStyle={styles.drawerContent}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetTitle, { color: colors.foreground }]}>
                  Workspace
                </Text>
                <Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]}>
                  AI Agent Home UI
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={12}>
                <Feather name="x" size={21} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <Pressable
              onPress={onNewChat}
              style={({ pressed }) => [styles.newChatButton, { backgroundColor: colors.secondary }, pressed && styles.pressed]}
            >
              <Feather name="plus" size={20} color={colors.foreground} />
              <Text style={[styles.newChatLabel, { color: colors.foreground }]}>New Chat</Text>
            </Pressable>
            <Text style={[styles.sheetSectionLabel, { color: colors.mutedForeground }]}>AI AGENTS</Text>
            <AgentRow name="Architect" initials="AR" tint="#fbbc04" status="Idle" colors={colors} />
            <AgentRow name="Frontend" initials="FE" tint="#34a853" status="Active" active colors={colors} />
            <AgentRow name="Reviewer" initials="RV" tint="#a8c7fa" status="Idle" colors={colors} />
            <Text style={[styles.sheetSectionLabel, { color: colors.mutedForeground }]}>WORKSPACE TOOLS</Text>
            {workspaceTools.map((tool) => (
              <ToolRow
                key={tool.label}
                icon={tool.icon}
                label={tool.label}
                detail={tool.detail}
                colors={colors}
                onPress={() => onTool(tool)}
              />
            ))}
            <Pressable onPress={onTasks} style={({ pressed }) => [styles.toolRow, pressed && styles.pressed]}>
              <Feather name="check-square" size={18} color={colors.primary} />
              <Text style={[styles.toolLabel, { color: colors.foreground }]}>Task manager</Text>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </Pressable>
            <View style={styles.filesHeader}>
              <Text style={[styles.sheetSectionLabel, { color: colors.mutedForeground }]}>FILES</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Refresh workspace files"
                onPress={onRetryFiles}
                hitSlop={8}
                style={({ pressed }) => [styles.refreshFilesButton, pressed && styles.pressed]}
              >
                <Feather name="refresh-cw" size={14} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {filesLoading ? (
              <Text style={[styles.filesMessage, { color: colors.mutedForeground }]}>
                Loading workspace files…
              </Text>
            ) : filesError ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading workspace files"
                onPress={onRetryFiles}
                style={({ pressed }) => [styles.filesMessageButton, pressed && styles.pressed]}
              >
                <Text style={[styles.filesMessage, { color: colors.primary }]}>
                  Couldn&apos;t load files. Tap to retry.
                </Text>
              </Pressable>
            ) : files.length > 0 ? (
              files.map((file) => (
                <FileRow key={file.id} file={file} colors={colors} onPress={() => onFile(file)} />
              ))
            ) : (
              <Text style={[styles.filesMessage, { color: colors.mutedForeground }]}>
                No workspace files found.
              </Text>
            )}
            <View style={styles.sheetFooter}>
              <Pressable onPress={onMemory} style={({ pressed }) => [styles.footerAction, pressed && styles.pressed]}>
                <Feather name="book-open" size={17} color={colors.mutedForeground} />
                <Text style={[styles.footerActionText, { color: colors.mutedForeground }]}>Memory</Text>
              </Pressable>
              <Pressable onPress={() => { onClose(); Alert.alert('Settings', 'Settings are ready for your next workspace connection.'); }} style={({ pressed }) => [styles.footerAction, pressed && styles.pressed]}>
                <Feather name="settings" size={17} color={colors.mutedForeground} />
                <Text style={[styles.footerActionText, { color: colors.mutedForeground }]}>Settings</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function AgentRow({
  name,
  initials,
  tint,
  status,
  active,
  colors,
}: {
  name: string;
  initials: string;
  tint: string;
  status: string;
  active?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.agentRow, active && { backgroundColor: colors.accent }]}>
      <View style={[styles.agentBadge, { backgroundColor: tint }]}>
        <Text style={styles.agentInitials}>{initials}</Text>
      </View>
      <Text style={[styles.agentName, { color: colors.foreground }]}>{name}</Text>
      <Text style={[styles.agentStatus, { color: colors.mutedForeground, backgroundColor: colors.secondary }]}>
        {status}
      </Text>
    </View>
  );
}

function ToolRow({
  icon,
  label,
  detail,
  colors,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  detail?: string;
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.toolRow, pressed && styles.pressed]}
    >
      <Feather name={icon} size={18} color={colors.primary} />
      <Text style={[styles.toolLabel, { color: colors.foreground }]}>{label}</Text>
      {detail && <Text style={[styles.toolDetail, { color: colors.mutedForeground, backgroundColor: colors.secondary }]}>{detail}</Text>}
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </Pressable>
  );
}

function FileRow({
  file,
  colors,
  onPress,
}: {
  file: WorkspaceFile;
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${file.path}`}
      onPress={onPress}
      style={({ pressed }) => [styles.fileRow, pressed && styles.pressed]}
    >
      <Feather
        name={file.type === 'directory' ? 'folder' : 'file-text'}
        size={16}
        color={file.type === 'directory' ? colors.primary : colors.mutedForeground}
      />
      <View style={styles.fileCopy}>
        <Text style={[styles.fileLabel, { color: colors.foreground }]} numberOfLines={1}>
          {file.name}
        </Text>
        {file.path !== file.name && (
          <Text style={[styles.filePath, { color: colors.mutedForeground }]} numberOfLines={1}>
            {file.path}
          </Text>
        )}
      </View>
      <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
    </Pressable>
  );
}

function SheetAction({
  icon,
  label,
  detail,
  colors,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  detail: string;
  colors: ReturnType<typeof useColors>;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.sheetAction, pressed && styles.pressed]}
    >
      <View style={[styles.sheetIcon, { backgroundColor: colors.secondary }]}>
        <Feather name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.sheetActionCopy}>
        <Text style={[styles.sheetActionLabel, { color: colors.foreground }]}>
          {label}
        </Text>
        <Text style={[styles.sheetActionDetail, { color: colors.mutedForeground }]}>
          {detail}
        </Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

function ModelPickerModal({
  visible,
  selectedId,
  colors,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedId: string;
  colors: ReturnType<typeof useColors>;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modelDialog, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.dialogHeader}>
            <View>
              <Text style={[styles.dialogTitle, { color: colors.foreground }]}>Choose a model</Text>
              <Text style={[styles.dialogSubtitle, { color: colors.mutedForeground }]}>
                Select the provider for this chat
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
          {models.map((option) => {
            const isSelected = option.id === selectedId;
            return (
              <Pressable
                key={option.id}
                onPress={() => onSelect(option.id)}
                style={({ pressed }) => [
                  styles.modelOption,
                  { backgroundColor: isSelected ? colors.accent : colors.secondary },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.modelOptionIcon, { backgroundColor: isSelected ? colors.primary : colors.muted }]}>
                  <Ionicons name="sparkles" size={15} color={isSelected ? colors.primaryForeground : colors.foreground} />
                </View>
                <View style={styles.modelOptionCopy}>
                  <Text style={[styles.modelOptionName, { color: colors.foreground }]}>{option.name}</Text>
                  <Text style={[styles.modelOptionDetail, { color: colors.mutedForeground }]}>{option.detail}</Text>
                </View>
                {isSelected && <Ionicons name="checkmark-circle" size={21} color={colors.primary} />}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

function TasksModal({
  visible,
  onClose,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.dialog, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.dialogHeader}>
            <View>
              <Text style={[styles.dialogTitle, { color: colors.foreground }]}>Tasks</Text>
              <Text style={[styles.dialogSubtitle, { color: colors.mutedForeground }]}>
                One active workspace task
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <View style={[styles.taskCard, { backgroundColor: colors.secondary }]}>
            <View style={styles.taskRow}>
              <Ionicons name="play-circle-outline" size={21} color={colors.primary} />
              <Text style={[styles.taskTitle, { color: colors.foreground }]}>
                Mobile workspace import
              </Text>
              <Text style={[styles.taskPercent, { color: colors.primary }]}>72%</Text>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View style={[styles.progressFill, { backgroundColor: colors.primary, width: '72%' }]} />
            </View>
            <Text style={[styles.taskDetail, { color: colors.mutedForeground }]}>
              Converting desktop interactions into native touch patterns
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.dialogButton,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.dialogButtonText, { color: colors.primaryForeground }]}>
              Done
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function MemoryModal({
  visible,
  onClose,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.dialog, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.dialogHeader}>
            <View>
              <Text style={[styles.dialogTitle, { color: colors.foreground }]}>
                Project memory
              </Text>
              <Text style={[styles.dialogSubtitle, { color: colors.mutedForeground }]}>
                Context the agent can keep in mind
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <View style={[styles.memoryItem, { borderColor: colors.border }]}>
            <Text style={[styles.memoryLabel, { color: colors.mutedForeground }]}>
              Framework
            </Text>
            <Text style={[styles.memoryValue, { color: colors.foreground }]}>
              Expo + React Native
            </Text>
          </View>
          <View style={[styles.memoryItem, { borderColor: colors.border }]}>
            <Text style={[styles.memoryLabel, { color: colors.mutedForeground }]}>
              Architecture
            </Text>
            <Text style={[styles.memoryValue, { color: colors.foreground }]}>
              Mobile-first workspace with local persistence
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.dialogButton,
              { backgroundColor: colors.secondary },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.dialogButtonText, { color: colors.foreground }]}>
              Close
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ToolModal({
  visible,
  tool,
  onClose,
  colors,
}: {
  visible: boolean;
  tool: WorkspaceTool | null;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  if (!tool) return null;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.dialog, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.dialogHeader}>
            <View style={styles.toolDialogHeading}>
              <View style={[styles.toolDialogIcon, { backgroundColor: colors.secondary }]}>
                <Feather name={tool.icon} size={19} color={colors.primary} />
              </View>
              <View style={styles.toolDialogCopy}>
                <Text style={[styles.dialogTitle, { color: colors.foreground }]}>{tool.label}</Text>
                <Text style={[styles.dialogSubtitle, { color: colors.mutedForeground }]}>
                  {tool.detail}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close tool">
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <Text style={[styles.toolDialogDescription, { color: colors.mutedForeground }]}>
            {tool.description}
          </Text>
          <View style={[styles.toolStatus, { backgroundColor: colors.secondary }]}>
            <View style={[styles.toolStatusDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.toolStatusText, { color: colors.foreground }]}>
              Workspace tool opened
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.dialogButton,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.dialogButtonText, { color: colors.primaryForeground }]}>
              Done
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function FileModal({
  visible,
  file,
  root,
  onClose,
  colors,
}: {
  visible: boolean;
  file: WorkspaceFile | null;
  root: string;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  if (!file) return null;

  const isDirectory = file.type === 'directory';
  const sizeLabel =
    file.size === undefined
      ? isDirectory
        ? 'Folder'
        : 'Unknown size'
      : file.size < 1024
        ? `${file.size} B`
        : file.size < 1024 * 1024
          ? `${(file.size / 1024).toFixed(1)} KB`
          : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.dialog, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.dialogHeader}>
            <View style={styles.toolDialogHeading}>
              <View style={[styles.toolDialogIcon, { backgroundColor: colors.secondary }]}>
                <Feather
                  name={isDirectory ? 'folder' : 'file-text'}
                  size={19}
                  color={colors.primary}
                />
              </View>
              <View style={styles.toolDialogCopy}>
                <Text style={[styles.dialogTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {file.name}
                </Text>
                <Text style={[styles.dialogSubtitle, { color: colors.mutedForeground }]}>
                  {isDirectory ? 'Directory' : 'Source file'}
                </Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={12} accessibilityLabel="Close file details">
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <View style={[styles.fileDetail, { borderColor: colors.border }]}>
            <Text style={[styles.fileDetailLabel, { color: colors.mutedForeground }]}>PATH</Text>
            <Text style={[styles.fileDetailValue, { color: colors.foreground }]}>{root}/{file.path}</Text>
          </View>
          <View style={[styles.fileDetail, { borderColor: colors.border }]}>
            <Text style={[styles.fileDetailLabel, { color: colors.mutedForeground }]}>SIZE</Text>
            <Text style={[styles.fileDetailValue, { color: colors.foreground }]}>{sizeLabel}</Text>
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [
              styles.dialogButton,
              { backgroundColor: colors.primary },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.dialogButtonText, { color: colors.primaryForeground }]}>
              Close
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Message>>(null);
  const {
    data: workspaceFilesData,
    isLoading: filesLoading,
    isError: filesError,
    refetch: refetchFiles,
  } = useListWorkspaceFiles();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [modelIndex, setModelIndex] = useState(0);
  const [modelPickerVisible, setModelPickerVisible] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [tasksVisible, setTasksVisible] = useState(false);
  const [memoryVisible, setMemoryVisible] = useState(false);
  const [activeTool, setActiveTool] = useState<WorkspaceTool | null>(null);
  const [activeFile, setActiveFile] = useState<WorkspaceFile | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);

  const model = models[modelIndex];
  const workspaceFiles = workspaceFilesData?.files ?? [];
  const workspaceRoot = workspaceFilesData?.root ?? 'workspace';
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const hasMessages = messages.length > 0;

  useEffect(() => {
    void AsyncStorage.getItem('ai-agent-home-mobile.messages').then((stored) => {
      if (stored) {
        try {
          setMessages(JSON.parse(stored) as Message[]);
        } catch {
          setMessages([]);
        }
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) {
      void AsyncStorage.setItem(
        'ai-agent-home-mobile.messages',
        JSON.stringify(messages),
      );
    }
  }, [hydrated, messages]);

  useEffect(() => {
    if (hasMessages) {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [hasMessages, isLoading]);

  const pickAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      setPendingAttachment({
        name: asset.name,
        uri: asset.uri,
        mimeType: asset.mimeType,
        size: asset.size,
      });
      void Haptics.selectionAsync();
    } catch {
      Alert.alert('Attachment failed', 'We could not open the file picker. Please try again.');
    }
  };

  const sendMessage = (value: string) => {
    const content = value.trim();
    const attachment = pendingAttachment;
    if ((!content && !attachment) || isLoading) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();
    setInput('');
    setPendingAttachment(null);
    setMessages((current) => [
      ...current,
      {
        id: makeId(),
        role: 'user',
        content: content || `Attached ${attachment?.name}`,
        attachment: attachment ?? undefined,
      },
    ]);
    setIsLoading(true);
    setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          id: makeId(),
          role: 'assistant',
          content: attachment
            ? `I received ${attachment.name}. I’ll include it in the next build step.`
            : 'Great direction. I’ll turn that into a clear build plan, then keep the next step small and shippable.',
        },
      ]);
      setIsLoading(false);
    }, 850);
  };

  const startNewChat = () => {
    setMessages([]);
    setInput('');
    setPendingAttachment(null);
    setIsLoading(false);
    setSheetVisible(false);
    void Haptics.selectionAsync();
  };

  const listData = useMemo(() => [...messages].reverse(), [messages]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <View style={[styles.header, { paddingTop: topInset + 10 }]}>
          <IconButton
            icon="menu"
            onPress={() => setSheetVisible(true)}
            colors={colors}
            accessibilityLabel="Open workspace menu"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Change model, currently ${model.name}`}
            onPress={() => setModelPickerVisible(true)}
            style={({ pressed }) => [
              styles.modelPill,
              { backgroundColor: colors.card, borderColor: colors.border },
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.modelCopy}>
              <Text style={[styles.modelName, { color: colors.foreground }]} numberOfLines={1}>
                {model.name} ({model.detail})
              </Text>
            </View>
            <View style={[styles.modelDivider, { backgroundColor: colors.border }]} />
            <Text style={[styles.modelMode, { color: colors.primary }]}>Auto</Text>
            <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
          </Pressable>
          <View style={styles.headerActions}>
            <Pressable onPress={() => setTasksVisible(true)} style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
              <Feather name="check-square" size={17} color={colors.foreground} />
            </Pressable>
            <Pressable onPress={() => setMemoryVisible(true)} style={({ pressed }) => [styles.headerAction, pressed && styles.pressed]}>
              <Feather name="book-open" size={17} color={colors.foreground} />
            </Pressable>
          </View>
        </View>

        {hasMessages ? (
          <FlatList
            ref={listRef}
            data={listData}
            inverted
            renderItem={({ item }) => (
              <MessageBubble message={item} colors={colors} />
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.messageList,
              { paddingBottom: 20, paddingTop: 18 },
            ]}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              isLoading ? (
                <View style={styles.loadingRow}>
                  <View style={styles.assistantAvatar}>
                    <Ionicons name="sparkles" size={16} color={colors.primary} />
                  </View>
                  <View style={[styles.loadingBubble, { backgroundColor: colors.card }]}>
                    <View style={styles.loadingDots}>
                      <View style={[styles.loadingDot, { backgroundColor: colors.primary }]} />
                      <View style={[styles.loadingDot, { backgroundColor: colors.primary }]} />
                      <View style={[styles.loadingDot, { backgroundColor: colors.primary }]} />
                    </View>
                    <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                      Thinking with {model.name}
                    </Text>
                  </View>
                </View>
              ) : null
            }
          />
        ) : (
          <HomeOverview colors={colors} />
        )}

        <View
          style={[
            styles.composerArea,
            { paddingBottom: Math.max(bottomInset, 14), backgroundColor: colors.background },
          ]}
        >
          {pendingAttachment && (
            <View style={[styles.pendingAttachment, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.attachmentIcon, { backgroundColor: colors.secondary }]}>
                <Feather
                  name={attachmentIcon(pendingAttachment)}
                  size={16}
                  color={colors.primary}
                />
              </View>
              <View style={styles.attachmentCopy}>
                <Text style={[styles.attachmentName, { color: colors.foreground }]} numberOfLines={1}>
                  {pendingAttachment.name}
                </Text>
                <Text style={[styles.attachmentSize, { color: colors.mutedForeground }]}>
                  {formatFileSize(pendingAttachment.size)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove attachment"
                onPress={() => setPendingAttachment(null)}
                hitSlop={8}
                style={({ pressed }) => [styles.removeAttachment, pressed && styles.pressed]}
              >
                <Feather name="x" size={17} color={colors.mutedForeground} />
              </Pressable>
            </View>
          )}
          <View
            style={[
              styles.composer,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Attach a photo, video, ZIP, or document"
              onPress={() => void pickAttachment()}
              style={({ pressed }) => [styles.composerIcon, pressed && styles.pressed]}
            >
              <Feather name="plus" size={21} color={colors.mutedForeground} />
            </Pressable>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask anything..."
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground }]}
              multiline
              maxLength={1200}
              returnKeyType="send"
              blurOnSubmit
              onSubmitEditing={() => sendMessage(input)}
              accessibilityLabel="Message composer"
               {...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {})}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={input.trim() || pendingAttachment ? 'Send message' : 'Use voice input'}
              onPress={() =>
                input.trim() || pendingAttachment
                  ? sendMessage(input)
                  : Alert.alert('Voice input', 'Voice input is ready to connect to your device.')
              }
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor: input.trim() || pendingAttachment ? colors.primary : colors.secondary,
                },
                pressed && styles.pressed,
              ]}
            >
              <Feather
                name={input.trim() || pendingAttachment ? 'arrow-up' : 'mic'}
                size={19}
                color={input.trim() || pendingAttachment ? colors.primaryForeground : colors.mutedForeground}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Sheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        colors={colors}
        onNewChat={startNewChat}
        onTasks={() => {
          setSheetVisible(false);
          setTasksVisible(true);
        }}
        onMemory={() => {
          setSheetVisible(false);
          setMemoryVisible(true);
        }}
        onTool={(tool) => {
          setSheetVisible(false);
          setActiveTool(tool);
        }}
        files={workspaceFiles}
        filesLoading={filesLoading}
        filesError={filesError}
        onRetryFiles={() => {
          void refetchFiles();
        }}
        onFile={(file) => {
          setSheetVisible(false);
          setActiveFile(file);
        }}
      />
      <TasksModal
        visible={tasksVisible}
        onClose={() => setTasksVisible(false)}
        colors={colors}
      />
      <MemoryModal
        visible={memoryVisible}
        onClose={() => setMemoryVisible(false)}
        colors={colors}
      />
      <ToolModal
        visible={activeTool !== null}
        tool={activeTool}
        onClose={() => setActiveTool(null)}
        colors={colors}
      />
      <FileModal
        visible={activeFile !== null}
        file={activeFile}
        root={workspaceRoot}
        onClose={() => setActiveFile(null)}
        colors={colors}
      />
      <ModelPickerModal
        visible={modelPickerVisible}
        selectedId={model.id}
        colors={colors}
        onClose={() => setModelPickerVisible(false)}
        onSelect={(id) => {
          const nextIndex = models.findIndex((option) => option.id === id);
          if (nextIndex >= 0) setModelIndex(nextIndex);
          setModelPickerVisible(false);
          void Haptics.selectionAsync();
        }}
      />
    </View>
  );
}

export default function ProtectedHomeScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  const { loading: firebaseLoading, user: firebaseUser } = useFirebaseAuth();
  const hasSession = Boolean(isSignedIn || firebaseUser);

  if (!isLoaded || firebaseLoading) return null;
  if (!hasSession) return <Redirect href={'/sign-in' as Href} />;
  return <HomeScreen />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: {
    minHeight: 78,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelPill: {
    flex: 1,
    maxWidth: 250,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 9,
  },
  modelCopy: { flex: 1 },
  modelName: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  modelMode: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  modelDivider: { width: 1, height: 20 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerAction: {
    width: 30,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeRow: {
    paddingHorizontal: 22,
    paddingBottom: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modePill: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeDot: { width: 6, height: 6, borderRadius: 3 },
  modeText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  connectionStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  connectionDot: { width: 6, height: 6, borderRadius: 3 },
  connectionText: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  overviewContent: {
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 24,
  },
  websiteHome: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 56,
  },
  heroMark: {
    alignSelf: 'center',
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  eyebrow: {
    alignSelf: 'center',
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 10,
  },
  greeting: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 28,
    lineHeight: 34,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 290,
    alignSelf: 'center',
    marginTop: 10,
  },
  projectCard: {
    marginTop: 34,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  projectTopRow: { flexDirection: 'row', alignItems: 'center' },
  projectIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectCopy: { flex: 1, marginLeft: 11 },
  projectTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  projectMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  projectDivider: { height: 1, marginVertical: 15 },
  projectStats: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  statLabel: { fontFamily: 'Inter_400Regular', fontSize: 10, marginBottom: 4 },
  statValue: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  openButton: {
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  openButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  sectionLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    marginTop: 28,
    marginBottom: 10,
  },
  promptGrid: { gap: 9 },
  promptCard: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 53,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 11,
  },
  promptLabel: { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },
  messageList: { paddingHorizontal: 18 },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginBottom: 16,
  },
  userMessageRow: { justifyContent: 'flex-end' },
  assistantAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 17,
  },
  messageText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  attachmentCard: {
    minWidth: 180,
    maxWidth: 260,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 8,
    marginBottom: 8,
  },
  pendingAttachment: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  attachmentIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentCopy: { flex: 1, minWidth: 0 },
  attachmentName: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  attachmentSize: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 3 },
  removeAttachment: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginBottom: 16,
  },
  loadingBubble: {
    borderRadius: 17,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  loadingDots: { flexDirection: 'row', gap: 3 },
  loadingDot: { width: 5, height: 5, borderRadius: 3 },
  loadingText: { fontFamily: 'Inter_400Regular', fontSize: 12 },
  composerArea: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  composerHintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  composerHint: { fontFamily: 'Inter_400Regular', fontSize: 11 },
  shortcutHint: { fontFamily: 'Inter_500Medium', fontSize: 11 },
  composer: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 21,
    paddingHorizontal: 7,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  composerIcon: {
    width: 42,
    height: 43,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 20,
    maxHeight: 90,
    paddingHorizontal: 5,
    paddingTop: 11,
    paddingBottom: 10,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimer: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
  },
  pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'flex-end',
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.52)',
    justifyContent: 'flex-start',
  },
  drawer: {
    width: 292,
    height: '100%',
    maxHeight: '100%',
    borderRightWidth: 1,
    flexShrink: 1,
  },
  drawerContent: {
    paddingHorizontal: 16,
    paddingTop: 62,
    paddingBottom: 28,
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  sheetTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 20 },
  sheetSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  newChatButton: {
    minHeight: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 17,
    gap: 12,
    marginBottom: 20,
  },
  newChatLabel: { fontFamily: 'Inter_500Medium', fontSize: 15 },
  sheetSectionLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 7,
  },
  agentRow: {
    minHeight: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
  },
  agentBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentInitials: { color: '#111216', fontFamily: 'Inter_700Bold', fontSize: 9 },
  agentName: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14 },
  agentStatus: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  toolRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
  },
  toolLabel: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14 },
  toolDetail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  filesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  refreshFilesButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filesMessageButton: {
    minHeight: 36,
    justifyContent: 'center',
  },
  filesMessage: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  fileRow: {
    minHeight: 35,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 10,
  },
  fileCopy: { flex: 1, minWidth: 0 },
  fileLabel: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  filePath: { fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 2 },
  sheetFooter: {
    borderTopWidth: 1,
    borderTopColor: '#333538',
    marginTop: 12,
    paddingTop: 14,
    flexDirection: 'row',
    gap: 24,
  },
  footerAction: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 4 },
  footerActionText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  sheetAction: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sheetIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetActionCopy: { flex: 1 },
  sheetActionLabel: { fontFamily: 'Inter_500Medium', fontSize: 14 },
  sheetActionDetail: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 4 },
  dialog: {
    marginHorizontal: 18,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 100,
  },
  modelDialog: {
    marginHorizontal: 18,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    width: '88%',
    alignSelf: 'center',
  },
  modelOption: {
    minHeight: 58,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    gap: 10,
    marginBottom: 8,
  },
  modelOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelOptionCopy: { flex: 1 },
  modelOptionName: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  modelOptionDetail: { fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  toolDialogHeading: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 11 },
  toolDialogIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolDialogCopy: { flex: 1 },
  dialogTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 20 },
  dialogSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 },
  toolDialogDescription: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19 },
  toolStatus: {
    minHeight: 42,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginTop: 18,
  },
  toolStatusDot: { width: 7, height: 7, borderRadius: 4 },
  toolStatusText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  taskCard: { borderRadius: 15, padding: 14 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  taskTitle: { fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },
  taskPercent: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  progressTrack: { height: 5, borderRadius: 3, marginTop: 13, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  taskDetail: { fontFamily: 'Inter_400Regular', fontSize: 11, lineHeight: 16, marginTop: 11 },
  dialogButton: {
    minHeight: 45,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 17,
  },
  dialogButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  memoryItem: { borderBottomWidth: 1, paddingBottom: 13, marginBottom: 14 },
  memoryLabel: { fontFamily: 'Inter_500Medium', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  memoryValue: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 6 },
  fileDetail: { borderBottomWidth: 1, paddingBottom: 13, marginBottom: 14 },
  fileDetailLabel: { fontFamily: 'Inter_500Medium', fontSize: 10, letterSpacing: 1 },
  fileDetailValue: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18, marginTop: 6 },
});