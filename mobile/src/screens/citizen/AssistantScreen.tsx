import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { AxiosError } from "axios";
import { Bot, ChevronRight, MessageCirclePlus, Send, Sparkles } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { AssistantMessage, AssistantSource } from "../../types";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useProfile } from "../../hooks/useAuth";
import {
  useAssistantConversations,
  useAssistantMessages,
  useSendAssistantMessage,
} from "../../hooks/useAssistant";

type Props = { navigation: any };

const MAX_MESSAGE_LENGTH = 2000;

const getAlertIdFromSource = (source: AssistantSource): string | null => {
  const hrefMatch = source.href?.match(/\/(?:incidents|reports)\/([a-f\d]{24})(?:$|[/?#])/i)?.[1];
  const idMatch = source.id.match(/^incident-([a-f\d]{24})$/i)?.[1];
  return hrefMatch ?? idMatch ?? null;
};

const getAssistantErrorMessage = (error: unknown, language: "vi" | "en"): string => {
  const status = error instanceof AxiosError ? error.response?.status : undefined;
  const vi = {
    unauthorized: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để dùng EcoAlert AI.",
    rate: "Bạn đang gửi yêu cầu quá nhanh. Vui lòng chờ một chút rồi thử lại.",
    missing: "Cuộc trò chuyện này không còn khả dụng. Hãy bắt đầu cuộc trò chuyện mới.",
    network: "Không có kết nối mạng. Nội dung bạn nhập vẫn được giữ lại để thử lại.",
    unavailable: "EcoAlert AI hiện chưa thể phản hồi. Vui lòng thử lại sau.",
  };
  const en = {
    unauthorized: "Your session has expired. Please sign in again to use EcoAlert AI.",
    rate: "You are sending requests too quickly. Please wait a moment and try again.",
    missing: "This conversation is no longer available. Start a new conversation.",
    network: "There is no network connection. Your draft has been kept so you can retry.",
    unavailable: "EcoAlert AI cannot respond right now. Please try again later.",
  };
  const copy = language === "vi" ? vi : en;

  if (status === 401 || status === 403) return copy.unauthorized;
  if (status === 429) return copy.rate;
  if (status === 404) return copy.missing;
  if (error instanceof AxiosError && !error.response) return copy.network;
  return copy.unavailable;
};

export const AssistantScreen: React.FC<Props> = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const { language } = useLanguage();
  const { data: profile } = useProfile();
  const conversations = useAssistantConversations();
  const [activeConversationId, setActiveConversationId] = useState<string>();
  const [draft, setDraft] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const listRef = useRef<FlatList<AssistantMessage>>(null);
  const messages = useAssistantMessages(activeConversationId);
  const sendMessage = useSendAssistantMessage();

  const role = profile?.role?.toUpperCase() || "CITIZEN";
  const copy = language === "vi"
    ? {
        subtitle: "Trợ lý thông minh",
        ready: "Sẵn sàng",
        newChat: "Cuộc trò chuyện mới",
        recent: "Gần đây",
        welcome: "Xin chào! Tôi là EcoAlert AI. Tôi có thể giúp bạn tìm hiểu về EcoAlert và các báo cáo mà tài khoản của bạn được phép truy cập.",
        suggestions: [
          "Báo cáo mới nhất của tôi",
          "Báo cáo nào đang được xử lý?",
          "Tôi cần làm gì tiếp với báo cáo gần nhất?",
          "Giải thích các trạng thái",
          "Làm sao gửi báo cáo?",
          "AI phân tích sự cố như thế nào?",
        ],
        placeholder: "Hỏi EcoAlert AI…",
        send: "Gửi tin nhắn",
        typing: "EcoAlert AI đang trả lời…",
        source: "Nguồn",
        emptyHistory: "Chưa có cuộc trò chuyện",
      }
    : {
        subtitle: "Smart assistant",
        ready: "Ready",
        newChat: "New conversation",
        recent: "Recent",
        welcome: "Hello! I’m EcoAlert AI. I can help you understand EcoAlert and the reports your account is authorized to access.",
        suggestions: [
          "My latest report",
          "Which reports are being processed?",
          "What should I do next with my latest report?",
          "Explain report statuses",
          "How do I submit a report?",
          "How does incident AI analysis work?",
        ],
        placeholder: "Ask EcoAlert AI…",
        send: "Send message",
        typing: "EcoAlert AI is responding…",
        source: "Sources",
        emptyHistory: "No conversations yet",
      };

  const roleSuggestions = role === "OFFICER"
    ? (language === "vi"
      ? ["Nhiệm vụ nào đang được phân công cho tôi?", "Tôi cần làm gì khi tới hiện trường?", "Giải thích quy trình check-in GPS", "Hướng dẫn ghi nhận báo cáo đã xử lý"]
      : ["Which tasks are assigned to me?", "What should I do when I arrive on site?", "Explain the GPS check-in workflow", "How do I record a resolution?"])
    : role === "ADMIN"
      ? (language === "vi"
        ? ["Sự cố nào cần xem xét?", "Cách phân công Cán bộ phù hợp?", "Màu nhiệt bản đồ thể hiện điều gì?", "Khi nào có thể đóng sự cố?"]
        : ["Which incidents need review?", "How should I assign an Officer?", "What does the incident density map show?", "When can an incident be closed?"])
      : copy.suggestions;

  useEffect(() => {
    if (initializedRef.current || !conversations.data) return;
    initializedRef.current = true;
    setActiveConversationId(conversations.data[0]?.id);
  }, [conversations.data]);

  useEffect(() => {
    if (messages.error) {
      setErrorMessage(getAssistantErrorMessage(messages.error, language));
    }
  }, [language, messages.error]);

  useEffect(() => {
    if (conversations.error) {
      setErrorMessage(getAssistantErrorMessage(conversations.error, language));
    }
  }, [conversations.error, language]);

  const chatMessages = messages.data ?? [];
  const canSend = draft.trim().length > 0 && !sendMessage.isPending;

  const conversationItems = useMemo(() => conversations.data ?? [], [conversations.data]);

  const openSource = (source: AssistantSource) => {
    const alertId = getAlertIdFromSource(source);
    if (!alertId) return;
    navigation
      .getParent?.()
      ?.navigate(role === "OFFICER" ? "OfficerAlertDetail" : "AlertDetail", { id: alertId });
  };

  const submit = (suggestedMessage?: string) => {
    const message = (suggestedMessage ?? draft).trim();
    if (!message || sendMessage.isPending) return;

    if (suggestedMessage) setDraft(message);
    setErrorMessage(null);
    sendMessage.mutate(
      { message, conversationId: activeConversationId },
      {
        onSuccess: (reply) => {
          setActiveConversationId(reply.conversation.id);
          setDraft("");
          requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
        },
        onError: (error) => {
          setErrorMessage(getAssistantErrorMessage(error, language));
        },
      },
    );
  };

  const startNewConversation = () => {
    initializedRef.current = true;
    setActiveConversationId(undefined);
    setDraft("");
    setErrorMessage(null);
  };

  const renderSource = (source: AssistantSource) => {
    const canOpen = Boolean(getAlertIdFromSource(source));
    return (
      <TouchableOpacity
        key={source.id}
        disabled={!canOpen}
        onPress={() => openSource(source)}
        activeOpacity={0.7}
        style={[styles.sourceRow, { borderColor: isDark ? "#334155" : "#DCE7F2" }]}
        accessibilityRole={canOpen ? "button" : "text"}
        accessibilityLabel={`${copy.source}: ${source.title}`}
      >
        <Text style={[styles.sourceText, { color: colors.secondary }]} numberOfLines={2}>{source.title}</Text>
        {canOpen ? <ChevronRight size={14} color={colors.secondary} /> : null}
      </TouchableOpacity>
    );
  };

  const renderMessage = ({ item }: { item: AssistantMessage }) => {
    const isUser = item.role === "USER";
    return (
      <View style={[styles.messageRow, isUser ? styles.userMessageRow : styles.assistantMessageRow]}>
        {!isUser ? (
          <View style={[styles.messageAvatar, { backgroundColor: isDark ? "rgba(34,197,94,0.18)" : "#DCFCE7" }]}>
            <Bot size={16} color={colors.primary} />
          </View>
        ) : null}
        <View
          style={[
            styles.bubble,
            isUser ? styles.userBubble : styles.assistantBubble,
            {
              backgroundColor: isUser ? colors.primaryDark : colors.card,
              borderColor: isUser ? colors.primaryDark : colors.border,
            },
          ]}
        >
          <Text style={[styles.messageText, { color: isUser ? "#FFFFFF" : colors.text }]}>{item.content}</Text>
          {!isUser && item.sources.length > 0 ? (
            <View style={styles.sourcesBlock}>
              <Text style={[styles.sourcesTitle, { color: colors.textMuted }]}>{copy.source}</Text>
              {item.sources.map(renderSource)}
            </View>
          ) : null}
          <Text style={[styles.messageTime, { color: isUser ? "rgba(255,255,255,0.72)" : colors.textMuted }]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </Text>
        </View>
      </View>
    );
  };

  const welcome = (
    <View style={styles.welcomeContainer}>
      <View style={[styles.welcomeIcon, { backgroundColor: isDark ? "rgba(34,197,94,0.18)" : "#DCFCE7" }]}>
        <Sparkles size={28} color={colors.primary} />
      </View>
      <Text style={[styles.welcomeTitle, { color: colors.text }]}>EcoAlert AI</Text>
      <Text style={[styles.welcomeText, { color: colors.textMuted }]}>{copy.welcome}</Text>
      <View style={styles.suggestions}>
        {roleSuggestions.map((suggestion) => (
          <TouchableOpacity
            key={suggestion}
            onPress={() => submit(suggestion)}
            activeOpacity={0.72}
            style={[styles.suggestion, { backgroundColor: colors.card, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={suggestion}
          >
            <Text style={[styles.suggestionText, { color: colors.text }]}>{suggestion}</Text>
            <ChevronRight size={15} color={colors.primary} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={[styles.headerIcon, { backgroundColor: isDark ? "rgba(34,197,94,0.16)" : "#DCFCE7" }]}>
            <Bot size={22} color={colors.primary} />
          </View>
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>EcoAlert AI</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
              <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>{copy.subtitle} · {copy.ready}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={startNewConversation}
            activeOpacity={0.72}
            style={[styles.newButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={copy.newChat}
          >
            <MessageCirclePlus size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {conversationItems.length > 0 ? (
          <View style={[styles.historyStrip, { borderBottomColor: colors.border }]}>
            <Text style={[styles.historyLabel, { color: colors.textMuted }]}>{copy.recent}</Text>
            <FlatList
              horizontal
              data={conversationItems}
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.historyList}
              renderItem={({ item }) => {
                const selected = item.id === activeConversationId;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setActiveConversationId(item.id);
                      setErrorMessage(null);
                    }}
                    style={[
                      styles.historyChip,
                      {
                        backgroundColor: selected ? colors.primaryLight : colors.card,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.historyChipText, { color: selected && !isDark ? colors.primaryDark : colors.text }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          data={chatMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messageList}
          contentContainerStyle={[styles.messageContent, chatMessages.length === 0 && styles.emptyMessageContent]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (chatMessages.length > 0) listRef.current?.scrollToEnd({ animated: true });
          }}
          ListEmptyComponent={
            messages.isLoading ? (
              <View style={styles.loadingHistory}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : welcome
          }
          ListFooterComponent={
            sendMessage.isPending ? (
              <View style={styles.typingRow} accessible accessibilityLabel={copy.typing} accessibilityState={{ busy: true }}>
                <View style={[styles.messageAvatar, { backgroundColor: isDark ? "rgba(34,197,94,0.18)" : "#DCFCE7" }]}>
                  <Bot size={16} color={colors.primary} />
                </View>
                <View style={[styles.typingBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <ActivityIndicator color={colors.primary} size="small" />
                  <Text style={[styles.typingText, { color: colors.textMuted }]}>{copy.typing}</Text>
                </View>
              </View>
            ) : null
          }
        />

        {errorMessage ? (
          <View style={[styles.errorBanner, { backgroundColor: isDark ? "rgba(239,68,68,0.15)" : "#FEF2F2", borderColor: isDark ? "rgba(248,113,113,0.4)" : "#FECACA" }]} accessible accessibilityRole="alert">
            <Text style={[styles.errorText, { color: isDark ? "#FCA5A5" : "#B91C1C" }]}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={[styles.composer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={copy.placeholder}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            multiline
            maxLength={MAX_MESSAGE_LENGTH}
            editable={!sendMessage.isPending}
            accessibilityLabel={copy.placeholder}
          />
          <TouchableOpacity
            onPress={() => submit()}
            disabled={!canSend}
            activeOpacity={0.72}
            style={[styles.sendButton, { backgroundColor: canSend ? colors.primaryDark : colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={copy.send}
            accessibilityState={{ disabled: !canSend, busy: sendMessage.isPending }}
          >
            {sendMessage.isPending ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Send size={19} color="#FFFFFF" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { minHeight: 68, borderBottomWidth: 1, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 11 },
  headerIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: "900" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  headerSubtitle: { fontSize: 11, fontWeight: "600" },
  newButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  historyStrip: { borderBottomWidth: 1, paddingVertical: 9 },
  historyLabel: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6, paddingHorizontal: 16, marginBottom: 7 },
  historyList: { paddingHorizontal: 16, gap: 8 },
  historyChip: { maxWidth: 180, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  historyChipText: { fontSize: 11, fontWeight: "700" },
  messageList: { flex: 1 },
  messageContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  emptyMessageContent: { flexGrow: 1, justifyContent: "center" },
  messageRow: { marginBottom: 14, maxWidth: "92%" },
  userMessageRow: { alignSelf: "flex-end" },
  assistantMessageRow: { alignSelf: "flex-start", flexDirection: "row", alignItems: "flex-start", gap: 8 },
  messageAvatar: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  bubble: { borderWidth: 1, paddingHorizontal: 13, paddingTop: 10, paddingBottom: 7 },
  userBubble: { borderRadius: 17, borderBottomRightRadius: 5 },
  assistantBubble: { borderRadius: 17, borderTopLeftRadius: 5, flexShrink: 1 },
  messageText: { fontSize: 14, lineHeight: 20 },
  messageTime: { fontSize: 9, fontWeight: "600", marginTop: 6, alignSelf: "flex-end" },
  sourcesBlock: { marginTop: 10, gap: 6 },
  sourcesTitle: { fontSize: 10, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  sourceRow: { minHeight: 38, borderTopWidth: 1, flexDirection: "row", alignItems: "center", gap: 4, paddingTop: 7 },
  sourceText: { flex: 1, fontSize: 11, lineHeight: 15, fontWeight: "700" },
  welcomeContainer: { alignItems: "center", paddingVertical: 24 },
  welcomeIcon: { width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  welcomeTitle: { fontSize: 21, fontWeight: "900", marginTop: 12 },
  welcomeText: { fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 7, maxWidth: 320 },
  suggestions: { width: "100%", gap: 8, marginTop: 20 },
  suggestion: { minHeight: 46, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  suggestionText: { flex: 1, fontSize: 12, fontWeight: "700" },
  loadingHistory: { minHeight: 280, alignItems: "center", justifyContent: "center" },
  typingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  typingBubble: { minHeight: 42, borderWidth: 1, borderRadius: 16, borderTopLeftRadius: 5, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  typingText: { fontSize: 11, fontWeight: "600" },
  errorBanner: { borderWidth: 1, marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 10 },
  errorText: { fontSize: 11, lineHeight: 16, fontWeight: "600" },
  composer: { borderTopWidth: 1, flexDirection: "row", alignItems: "flex-end", gap: 9, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10 },
  input: { flex: 1, minHeight: 44, maxHeight: 112, borderWidth: 1, borderRadius: 16, paddingHorizontal: 13, paddingTop: 11, paddingBottom: 11, fontSize: 14, lineHeight: 19 },
  sendButton: { width: 44, height: 44, borderRadius: 15, alignItems: "center", justifyContent: "center" },
});
