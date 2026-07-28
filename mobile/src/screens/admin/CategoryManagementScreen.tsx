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
import { COLORS } from "../../utils/constants";
import { Category } from "../../types";

export const CategoryManagementScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
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
      RNAlert.alert("Error", msg);
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
              RNAlert.alert("Deleted", "Category deleted successfully.");
            } catch (err: any) {
              const msg = err.response?.data?.message || err.message || "Failed to delete category.";
              RNAlert.alert("Error", msg);
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
            <Text style={styles.categoryName}>{item.name}</Text>
            <Text style={styles.categoryCode}>code: {item.code}</Text>
          </View>
        </View>
        <View style={styles.badgeBox}>
          <Badge
            label={(item.defaultSeverity || "MEDIUM").toUpperCase()}
            type="custom"
            bgColor="#F3E8FF"
            textColor="#7C3AED"
          />
        </View>
      </View>

      {item.description ? <Text style={styles.description}>{item.description}</Text> : null}

      <View style={styles.cardFooter}>
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Active</Text>
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
            <Edit2 size={16} color="#7C3AED" />
            <Text style={[styles.actionText, { color: "#7C3AED" }]}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => handleDeleteCategory(item)}>
            <Trash2 size={16} color="#DC2626" />
            <Text style={[styles.actionText, { color: "#DC2626" }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </GlassCard>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Tag size={24} color="#7C3AED" />
          <Text style={styles.headerTitle}>Category Management</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            setEditingCategory(null);
            setIsModalOpen(true);
          }}
        >
          <Plus size={18} color="#FFF" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Row */}
      <View style={styles.filterBar}>
        <Text style={styles.filterLabel}>Show Inactive Categories</Text>
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
              <Folder size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No categories found.</Text>
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
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: COLORS.text },
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
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  filterLabel: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  listContent: { padding: 20, paddingBottom: 40 },
  card: { marginBottom: 14, padding: 16, borderRadius: 20 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { fontSize: 22 },
  categoryName: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  categoryCode: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  badgeBox: { alignItems: "flex-end" },
  description: { fontSize: 13, color: COLORS.textMuted, marginTop: 10, lineHeight: 18 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  switchLabel: { fontSize: 12, fontWeight: "700", color: COLORS.textMuted },
  actions: { flexDirection: "row", gap: 12 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  actionText: { fontSize: 12, fontWeight: "700" },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyText: { marginTop: 12, fontSize: 14, color: COLORS.textMuted },
});
