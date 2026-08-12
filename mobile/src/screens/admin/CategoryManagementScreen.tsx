import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Switch,
  Alert as RNAlert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tag, Plus, Edit2, Trash2, Folder } from "lucide-react-native";
import { useCategories, useDeleteCategory, useUpdateCategory } from "../../hooks/useCategories";
import { CategoryFormModal } from "../../components/modals/CategoryFormModal";
import { GlassCard } from "../../components/ui/GlassCard";
import { Badge } from "../../components/ui/Badge";
import { useTheme } from "../../context/ThemeContext";
import { Category } from "../../types";

export const CategoryManagementScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [includeInactive, setIncludeInactive] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const { data: categories = [], isLoading, refetch, isRefetching } = useCategories(includeInactive);
  const updateCategoryMutation = useUpdateCategory();
  const deleteCategoryMutation = useDeleteCategory();

  const handleToggleActive = async (category: Category) => {
    try {
      await updateCategoryMutation.mutateAsync({
        id: category._id,
        data: { isActive: !category.isActive },
      });
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || "Failed to update category status.";
      RNAlert.alert("Lỗi", msg);
    }
  };

  const handleDeleteCategory = (category: Category) => {
    RNAlert.alert(
      "Delete Category",
      `Are you sure you want to delete category "${category.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCategoryMutation.mutateAsync(category._id);
              RNAlert.alert("Đã xóa", "Xóa danh mục thành công.");
            } catch (err: any) {
              const msg = err.response?.data?.message || err.message || "Failed to delete category.";
              RNAlert.alert("Lỗi", msg);
            }
          },
        },
      ]
    );
  };

  const renderCategoryItem = ({ item }: { item: Category }) => (
    <GlassCard style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.icon}>{item.icon || "🏷️"}</Text>
          <View>
            <Text style={[styles.categoryName, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.categoryCode, { color: colors.textMuted }]}>mã: {item.code}</Text>
          </View>
        </View>
        <View style={styles.badgeBox}>
          <Badge
            label={(item.defaultSeverity || "MEDIUM").toUpperCase()}
            type="custom"
            bgColor={isDark ? "rgba(124, 58, 237, 0.3)" : "#F3E8FF"}
            textColor={isDark ? "#C4B5FD" : "#7C3AED"}
          />
        </View>
      </View>

      {item.description ? <Text style={[styles.description, { color: colors.textMuted }]}>{item.description}</Text> : null}

      <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: colors.textMuted }]}>Hoạt động</Text>
          <Switch
            value={item.isActive}
            onValueChange={() => handleToggleActive(item)}
            trackColor={{ true: "#7C3AED" }}
          />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => {
              setEditingCategory(item);
              setIsModalOpen(true);
            }}
          >
            <Edit2 size={16} color={isDark ? "#A78BFA" : "#7C3AED"} />
            <Text style={[styles.actionText, { color: isDark ? "#A78BFA" : "#7C3AED" }]}>Chỉnh sửa</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteCategory(item)}>
            <Trash2 size={16} color={isDark ? "#FCA5A5" : "#DC2626"} />
            <Text style={[styles.actionText, { color: isDark ? "#FCA5A5" : "#DC2626" }]}>Xóa</Text>
          </TouchableOpacity>
        </View>
      </View>
    </GlassCard>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleRow}>
          <Tag size={24} color={isDark ? "#A78BFA" : "#7C3AED"} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Quản lý danh mục</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            setEditingCategory(null);
            setIsModalOpen(true);
          }}
        >
          <Plus size={18} color="#FFF" />
          <Text style={styles.addBtnText}>Thêm</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Row */}
      <View style={[styles.filterBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.filterLabel, { color: colors.text }]}>Hiển thị danh mục không hoạt động</Text>
        <Switch
          value={includeInactive}
          onValueChange={setIncludeInactive}
          trackColor={{ true: "#7C3AED" }}
        />
      </View>

      <FlatList
        data={categories}
        keyExtractor={(item) => item._id}
        renderItem={renderCategoryItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading || isRefetching} onRefresh={refetch} tintColor="#7C3AED" />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Folder size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Không tìm thấy danh mục.</Text>
            </View>
          ) : null
        }
      />

      <CategoryFormModal
        visible={isModalOpen}
        category={editingCategory}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCategory(null);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#7C3AED",
  },
  addBtnText: { fontSize: 13, fontWeight: "700", color: "#FFF" },
  filterBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  filterLabel: { fontSize: 13, fontWeight: "600" },
  listContent: { padding: 20, paddingBottom: 40 },
  card: { marginBottom: 14, padding: 16, borderRadius: 20 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { fontSize: 22 },
  categoryName: { fontSize: 16, fontWeight: "800" },
  categoryCode: { fontSize: 12, marginTop: 2 },
  badgeBox: { alignItems: "flex-end" },
  description: { fontSize: 13, marginTop: 10, lineHeight: 18 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  switchLabel: { fontSize: 12, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 12 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionText: { fontSize: 12, fontWeight: "700" },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyText: { marginTop: 12, fontSize: 14 },
});

