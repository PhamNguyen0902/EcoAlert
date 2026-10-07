import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Bot,
  Send,
  Sparkles,
  CheckCircle2,
  Bookmark,
  ExternalLink,
  Trash2,
} from "lucide-react-native";
import { useTheme } from "../../context/ThemeContext";
import { aiService, RagCitation } from "../../api/aiSerivce";
import { ms } from "date-fns/locale";

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  suggestedActions?: string[];
  citations?: RagCitation[];
  timestamp: Date;
}

const QUICK_PROMPTS = [
  "Đến hiện trường rác thì làm gì đầu tiên?",
  "Hành vi vứt rác sinh hoạt phạt bao nhiêu tiền?",
  "Người dân chống đối dọn dẹp thì xử lý thế nào?",
  "Vật tư cần chuẩn bị khi dọn bãi rác tự phát?",
];
const CONNECTION_ERROR_TEXT =
  "Không thể kết nối đến máy chủ AI. Vui lòng kiểm tra kết nối mạng và thử lại.";
export const OfficerAssistantScreen: React.FC = () => {
  // Tự động ngắt dòng trước các số thứ tự 1., 2., 3. hoặc gạch đầu dòng
  const formatAssistantText = (text: string) => {
    if (!text) return "";
    return (
      text
        // Thêm \n trước số thứ tự (vd: " 1. ", " 2. ") nếu phía trước chưa có xuống dòng
        .replace(/([^\n])\s*(\d+\.\s+)/g, "$1\n$2")
        // Thêm \n trước gạch đầu dòng (vd: " - ") nếu phía trước chưa có xuống dòng
        .replace(/([^\n])\s*(-\s+)/g, "$1\n$2")
    );
  };

  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "Xin chào, tôi là Trợ lý AI hỗ trợ xử lý sự cố rác thải EcoAlert. Tôi có thể hướng dẫn quy trình hiện trường và viện dẫn căn cứ pháp lý theo Nghị định 45/2022/NĐ-CP. Cán bộ cần hỗ trợ gì?",
      timestamp: new Date(),
    },
  ]);

  const handleSend = async (questionText?: string) => {
    const query = (questionText || input).trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: query,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!questionText) setInput("");
    setLoading(true);

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      // lọc bỏ tin nhắn chào và tin báo lỗi mạng đồng thời giới hạn số lượt trò chuyện gần nhất
      const history = messages
        .filter(
          (m) =>
            !m.id.startsWith("welcome") && m.text !== CONNECTION_ERROR_TEXT,
        )
        .slice(-6)
        .map((m) => ({ role: m.sender, text: m.text.slice(0, 600) }));
      const res = await aiService.askOfficerAssistant(
        query,
        "illegal_dumping",
        history,
      );

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: res.answer,
        suggestedActions: res.suggestedActions,
        citations: res.citations,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: CONNECTION_ERROR_TEXT,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const handleOpenSource = async (url?: string) => {
    if (!url) return;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (e) {
      console.warn("Không thể mở liên kết:", e);
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: "welcome-reset",
        sender: "assistant",
        text: "Đã làm mới đoạn hội thoại. Đồng chí có câu hỏi nào khác không?",
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      {/* HEADER */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 10,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerTitleRow}>
          <View
            style={[styles.avatarBot, { backgroundColor: colors.primaryLight }]}
          >
            <Bot size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              Trợ lý Cán bộ Hiện trường
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              Hỗ trợ nghiệp vụ & Căn cứ pháp lý NĐ 45
            </Text>
          </View>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={clearChat}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* danh sách tin nhắn */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.chatList}
        contentContainerStyle={[styles.chatContent, { paddingBottom: 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* danh sách câu hỏi gợi ý nhanh */}
        <View style={styles.quickPromptsSection}>
          <Text style={[styles.quickPromptsLabel, { color: colors.textMuted }]}>
            <Sparkles size={13} color={colors.primary} /> Gợi ý câu hỏi nghiệp
            vụ:
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickPromptsScroll}
          >
            {QUICK_PROMPTS.map((prompt, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.quickPromptChip,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => handleSend(prompt)}
                disabled={loading}
              >
                <Text style={[styles.quickPromptText, { color: colors.text }]}>
                  {prompt}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* nội dung các lượt trò chuyện */}
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          return (
            <View
              key={msg.id}
              style={[
                styles.messageRow,
                isUser ? styles.messageRowUser : styles.messageRowBot,
              ]}
            >
              {!isUser && (
                <View
                  style={[
                    styles.botMiniAvatar,
                    { backgroundColor: colors.primaryLight },
                  ]}
                >
                  <Bot size={14} color={colors.primary} />
                </View>
              )}

              <View
                style={[
                  styles.messageBubble,
                  isUser
                    ? [styles.userBubble, { backgroundColor: colors.primary }]
                    : [
                        styles.botBubble,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ],
                ]}
              >
                {/* Văn bản trả lời */}
                <Text
                  style={[
                    styles.messageText,
                    { color: isUser ? "#FFFFFF" : colors.text },
                  ]}
                >
                  {isUser ? msg.text : formatAssistantText(msg.text)}
                </Text>

                {/* thao tác nghiệp vụ cần thực hiện trên ứng dụng */}
                {!isUser &&
                  msg.suggestedActions &&
                  msg.suggestedActions.length > 0 && (
                    <View
                      style={[
                        styles.actionSection,
                        { borderTopColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.actionSectionTitle,
                          { color: colors.textMuted },
                        ]}
                      >
                        Thao tác nghiệp vụ cần thực hiện:
                      </Text>
                      <View style={styles.actionBadgesWrap}>
                        {msg.suggestedActions.map((actionLabel, i) => (
                          <View
                            key={i}
                            style={[
                              styles.actionBadge,
                              {
                                backgroundColor: isDark
                                  ? "rgba(16, 185, 129, 0.2)"
                                  : "#ECFDF5",
                                borderColor: isDark
                                  ? "rgba(16, 185, 129, 0.4)"
                                  : "#A7F3D0",
                              },
                            ]}
                          >
                            <CheckCircle2 size={13} color="#059669" />
                            <Text style={styles.actionBadgeText}>
                              {actionLabel}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                {/* căn cứ pháp lý và liên kết xem văn bản gốc */}
                {!isUser && msg.citations && msg.citations.length > 0 && (
                  <View
                    style={[
                      styles.citationsSection,
                      { borderTopColor: colors.border },
                    ]}
                  >
                    <View style={styles.citationHeader}>
                      <Bookmark size={13} color={colors.primary} />
                      <Text
                        style={[
                          styles.citationHeaderText,
                          { color: colors.text },
                        ]}
                      >
                        Căn cứ pháp lý & Tài liệu chứng minh:
                      </Text>
                    </View>

                    {msg.citations.map((c, i) => (
                      <View
                        key={i}
                        style={[
                          styles.citationCard,
                          {
                            backgroundColor: isDark
                              ? "rgba(255, 255, 255, 0.05)"
                              : "#F8FAFC",
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.citationTitle, { color: colors.text }]}
                          numberOfLines={2}
                        >
                          • {c.title}
                        </Text>

                        <View style={styles.citationFooter}>
                          <Text style={styles.citationScoreBadge}>
                            {c.score}% khớp
                          </Text>

                          {c.source_url && (
                            <TouchableOpacity
                              style={[
                                styles.openLinkBtn,
                                { backgroundColor: colors.primaryLight },
                              ]}
                              onPress={() => handleOpenSource(c.source_url)}
                            >
                              <Text
                                style={[
                                  styles.openLinkText,
                                  { color: colors.primaryDark },
                                ]}
                              >
                                Xem văn bản gốc
                              </Text>
                              <ExternalLink
                                size={12}
                                color={colors.primaryDark}
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {/* hiệu ứng chờ phản hồi */}
        {loading && (
          <View style={[styles.messageRow, styles.messageRowBot]}>
            <View
              style={[
                styles.botMiniAvatar,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <Bot size={14} color={colors.primary} />
            </View>
            <View
              style={[
                styles.messageBubble,
                styles.botBubble,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                },
              ]}
            >
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ fontSize: 13, color: colors.textMuted }}>
                Đang phản hồi ...
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* INPUT BAR */}
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
          },
        ]}
      >
        <TextInput
          style={[
            styles.textInput,
            {
              backgroundColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#F1F5F9",
              color: colors.text,
            },
          ]}
          placeholder="Hỏi về quy trình xử lý rác, thẩm quyền, mức phạt..."
          placeholderTextColor={colors.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={300}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            {
              backgroundColor: input.trim() ? colors.primary : colors.border,
            },
          ]}
          onPress={() => handleSend()}
          disabled={!input.trim() || loading}
        >
          <Send size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarBot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerActionBtn: {
    padding: 6,
  },
  chatList: {
    flex: 1,
  },
  chatContent: {
    padding: 14,
  },
  quickPromptsSection: {
    marginBottom: 14,
  },
  quickPromptsLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  quickPromptsScroll: {
    gap: 8,
  },
  quickPromptChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickPromptText: {
    fontSize: 12,
    fontWeight: "500",
  },
  messageRow: {
    flexDirection: "row",
    marginVertical: 6,
    maxWidth: "88%",
  },
  messageRowUser: {
    alignSelf: "flex-end",
  },
  messageRowBot: {
    alignSelf: "flex-start",
  },
  botMiniAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
    marginTop: 2,
  },
  messageBubble: {
    borderRadius: 14,
    padding: 12,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  botBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    maxWidth: "92%",
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  actionSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  actionSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  actionBadgesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  actionBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  actionBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#059669",
  },
  citationsSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  citationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  citationHeaderText: {
    fontSize: 12,
    fontWeight: "700",
  },
  citationCard: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 5,
  },
  citationTitle: {
    fontSize: 12,
    fontWeight: "500",
  },
  citationFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
  citationScoreBadge: {
    fontSize: 10,
    color: "#059669",
    fontWeight: "600",
  },
  openLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
    gap: 4,
  },
  openLinkText: {
    fontSize: 11,
    fontWeight: "700",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 90,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
});
