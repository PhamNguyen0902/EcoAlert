# Cây thư mục mã nguồn EcoAlert

Cây này đi đến từng tệp nguồn, cấu hình, kiểm thử, tài liệu và asset đang có trong workspace.
`node_modules`, các thư mục `dist`, cache Expo, metadata Git và 8.240 ảnh/nhãn YOLO được để dưới dạng nhánh gộp có ghi rõ số lượng.

```text
EcoAlert/
|-- .git/
|   +-- [Git metadata; omitted]
|-- backend/
|   |-- ai-service/
|   |   |-- dist/
|   |   |   +-- [compiled output; omitted]
|   |   |-- src/
|   |   |   |-- assistant/
|   |   |   |   |-- authorized-data.retriever.ts
|   |   |   |   |-- intent-detector.ts
|   |   |   |   |-- knowledge.ts
|   |   |   |   |-- llm-provider.ts
|   |   |   |   |-- tool-registry.ts
|   |   |   |   +-- types.ts
|   |   |   |-- config/
|   |   |   |   |-- database.config.ts
|   |   |   |   |-- env.config.ts
|   |   |   |   +-- openrouter.config.ts
|   |   |   |-- controllers/
|   |   |   |   +-- assistant.controller.ts
|   |   |   |-- middlewares/
|   |   |   |   +-- assistant-auth.middleware.ts
|   |   |   |-- models/
|   |   |   |   |-- alert-read.model.ts
|   |   |   |   |-- assistant-message.model.ts
|   |   |   |   +-- conversation.model.ts
|   |   |   |-- routes/
|   |   |   |   +-- assistant.routes.ts
|   |   |   |-- services/
|   |   |   |   |-- ai-task-router.ts
|   |   |   |   |-- assistant.service.ts
|   |   |   |   |-- category-normalizer.service.ts
|   |   |   |   |-- image-validation.service.ts
|   |   |   |   |-- multimodal-analysis.service.ts
|   |   |   |   |-- openrouter.service.ts
|   |   |   |   |-- rabbitmq.service.ts
|   |   |   |   |-- redis.service.ts
|   |   |   |   |-- vision-client.service.ts
|   |   |   |   |-- vision-evidence.service.ts
|   |   |   |   +-- vision-fusion.service.ts
|   |   |   |-- tests/
|   |   |   |   |-- assistant-rag.test.ts
|   |   |   |   |-- confidence-resolution.test.ts
|   |   |   |   |-- image-validation.service.test.ts
|   |   |   |   |-- multimodal-analysis.service.test.ts
|   |   |   |   |-- openrouter.service.test.ts
|   |   |   |   |-- overall-incident-analysis.test.ts
|   |   |   |   |-- rabbitmq.service.test.ts
|   |   |   |   |-- vision-client.service.test.ts
|   |   |   |   +-- vision-fusion.service.test.ts
|   |   |   |-- app.ts
|   |   |   +-- server.ts
|   |   |-- .env
|   |   |-- .env.example
|   |   |-- package-lock.json
|   |   |-- package.json
|   |   +-- tsconfig.json
|   |-- alert-service/
|   |   |-- dist/
|   |   |   +-- [compiled output; omitted]
|   |   |-- src/
|   |   |   |-- config/
|   |   |   |   |-- database.config.ts
|   |   |   |   +-- env.config.ts
|   |   |   |-- controllers/
|   |   |   |   |-- alert.controller.ts
|   |   |   |   +-- category.controller.ts
|   |   |   |-- dtos/
|   |   |   |   +-- alert.dto.ts
|   |   |   |-- middlewares/
|   |   |   |   |-- error-handler.middleware.ts
|   |   |   |   +-- validate.middleware.ts
|   |   |   |-- models/
|   |   |   |   |-- alert.model.ts
|   |   |   |   |-- base.model.ts
|   |   |   |   |-- category.model.ts
|   |   |   |   +-- officer-shift.model.ts
|   |   |   |-- repositories/
|   |   |   |   +-- alert.repository.ts
|   |   |   |-- routes/
|   |   |   |   +-- index.ts
|   |   |   |-- services/
|   |   |   |   |-- alert.service.ts
|   |   |   |   |-- category.service.ts
|   |   |   |   |-- officer-shift.service.ts
|   |   |   |   |-- rabbitmq.service.ts
|   |   |   |   +-- user-directory.service.ts
|   |   |   |-- tests/
|   |   |   |   |-- ai-analysis.test.ts
|   |   |   |   |-- geo-evidence.test.ts
|   |   |   |   |-- officer-shift-workload.test.ts
|   |   |   |   +-- workflow-authorization.test.ts
|   |   |   |-- utils/
|   |   |   |   +-- geo-evidence.util.ts
|   |   |   |-- app.ts
|   |   |   +-- server.ts
|   |   |-- .env.example
|   |   |-- package-lock.json
|   |   |-- package.json
|   |   +-- tsconfig.json
|   |-- api-gateway/
|   |   |-- dist/
|   |   |   +-- [compiled output; omitted]
|   |   |-- src/
|   |   |   +-- server.ts
|   |   |-- .env.example
|   |   |-- package-lock.json
|   |   |-- package.json
|   |   +-- tsconfig.json
|   |-- gis-service/
|   |   |-- dist/
|   |   |   +-- [compiled output; omitted]
|   |   |-- src/
|   |   |   |-- config/
|   |   |   |   |-- database.config.ts
|   |   |   |   +-- env.config.ts
|   |   |   |-- controllers/
|   |   |   |   +-- gis.controller.ts
|   |   |   |-- middlewares/
|   |   |   |   +-- error-handler.middleware.ts
|   |   |   |-- models/
|   |   |   |   +-- location.model.ts
|   |   |   |-- routes/
|   |   |   |   +-- index.ts
|   |   |   |-- services/
|   |   |   |   |-- gis.service.ts
|   |   |   |   |-- rabbitmq.service.ts
|   |   |   |   |-- weather-normalization.ts
|   |   |   |   +-- weather.service.ts
|   |   |   |-- tests/
|   |   |   |   |-- incident-density.test.ts
|   |   |   |   +-- weather-normalization.test.ts
|   |   |   |-- app.ts
|   |   |   +-- server.ts
|   |   |-- .env
|   |   |-- package-lock.json
|   |   |-- package.json
|   |   +-- tsconfig.json
|   |-- media-service/
|   |   |-- dist/
|   |   |   +-- [compiled output; omitted]
|   |   |-- src/
|   |   |   |-- config/
|   |   |   |   |-- cloudinary.config.ts
|   |   |   |   +-- database.config.ts
|   |   |   |-- controllers/
|   |   |   |   +-- upload.controller.ts
|   |   |   |-- middlewares/
|   |   |   |   +-- error-handler.middleware.ts
|   |   |   |-- models/
|   |   |   |   +-- media.model.ts
|   |   |   |-- routes/
|   |   |   |   +-- upload.routes.ts
|   |   |   |-- services/
|   |   |   |   +-- s3.service.ts
|   |   |   |-- app.ts
|   |   |   +-- server.ts
|   |   |-- .env
|   |   |-- .env.example
|   |   |-- package-lock.json
|   |   |-- package.json
|   |   +-- tsconfig.json
|   |-- notification-service/
|   |   |-- dist/
|   |   |   +-- [compiled output; omitted]
|   |   |-- src/
|   |   |   |-- config/
|   |   |   |   +-- env.config.ts
|   |   |   |-- controllers/
|   |   |   |   +-- notification.controller.ts
|   |   |   |-- models/
|   |   |   |   +-- notification.model.ts
|   |   |   |-- repositories/
|   |   |   |   +-- notification.repository.ts
|   |   |   |-- routes/
|   |   |   |   +-- index.ts
|   |   |   |-- services/
|   |   |   |   |-- notification.service.ts
|   |   |   |   |-- rabbitmq.service.ts
|   |   |   |   +-- socket.service.ts
|   |   |   |-- app.ts
|   |   |   +-- server.ts
|   |   |-- .env.example
|   |   |-- package-lock.json
|   |   |-- package.json
|   |   +-- tsconfig.json
|   |-- shared/
|   |   |-- dist/
|   |   |   +-- [compiled output; omitted]
|   |   |-- src/
|   |   |   |-- constants/
|   |   |   |   |-- event-names.constant.ts
|   |   |   |   |-- http-status.constant.ts
|   |   |   |   +-- index.ts
|   |   |   |-- dtos/
|   |   |   |   |-- api-response.dto.ts
|   |   |   |   |-- index.ts
|   |   |   |   +-- pagination.dto.ts
|   |   |   |-- enums/
|   |   |   |   |-- alert-category.enum.ts
|   |   |   |   |-- alert-status.enum.ts
|   |   |   |   |-- index.ts
|   |   |   |   |-- media-type.enum.ts
|   |   |   |   |-- notification-status.enum.ts
|   |   |   |   |-- notification-type.enum.ts
|   |   |   |   |-- severity.enum.ts
|   |   |   |   +-- user-role.enum.ts
|   |   |   |-- errors/
|   |   |   |   |-- app-error.ts
|   |   |   |   |-- bad-request.error.ts
|   |   |   |   |-- conflict.error.ts
|   |   |   |   |-- forbidden.error.ts
|   |   |   |   |-- index.ts
|   |   |   |   |-- not-found.error.ts
|   |   |   |   |-- unauthorized.error.ts
|   |   |   |   +-- validation.error.ts
|   |   |   |-- interfaces/
|   |   |   |   |-- ai-analysis.interface.ts
|   |   |   |   |-- base-document.interface.ts
|   |   |   |   |-- base-repository.interface.ts
|   |   |   |   |-- event-message.interface.ts
|   |   |   |   |-- index.ts
|   |   |   |   +-- user-payload.interface.ts
|   |   |   |-- types/
|   |   |   |   |-- common.types.ts
|   |   |   |   +-- index.ts
|   |   |   |-- utils/
|   |   |   |   |-- ai-confidence.util.ts
|   |   |   |   |-- api-response.util.ts
|   |   |   |   |-- async-handler.util.ts
|   |   |   |   |-- index.ts
|   |   |   |   +-- logger.util.ts
|   |   |   +-- index.ts
|   |   |-- package-lock.json
|   |   |-- package.json
|   |   +-- tsconfig.json
|   |-- user-service/
|   |   |-- dist/
|   |   |   +-- [compiled output; omitted]
|   |   |-- src/
|   |   |   |-- config/
|   |   |   |   |-- database.config.ts
|   |   |   |   |-- env.config.ts
|   |   |   |   |-- index.ts
|   |   |   |   +-- redis.config.ts
|   |   |   |-- controllers/
|   |   |   |   |-- auth.controller.ts
|   |   |   |   +-- user.controller.ts
|   |   |   |-- dtos/
|   |   |   |   |-- auth.dto.ts
|   |   |   |   +-- user.dto.ts
|   |   |   |-- middlewares/
|   |   |   |   |-- auth.middleware.ts
|   |   |   |   |-- error-handler.middleware.ts
|   |   |   |   +-- validate.middleware.ts
|   |   |   |-- models/
|   |   |   |   |-- audit-log.model.ts
|   |   |   |   |-- base.model.ts
|   |   |   |   |-- refresh-token.model.ts
|   |   |   |   +-- user.model.ts
|   |   |   |-- repositories/
|   |   |   |   |-- refresh-token.repository.ts
|   |   |   |   +-- user.repository.ts
|   |   |   |-- routes/
|   |   |   |   |-- auth.routes.ts
|   |   |   |   |-- index.ts
|   |   |   |   +-- user.routes.ts
|   |   |   |-- services/
|   |   |   |   |-- audit-log.service.ts
|   |   |   |   |-- auth.service.ts
|   |   |   |   |-- token.service.ts
|   |   |   |   +-- user.service.ts
|   |   |   |-- utils/
|   |   |   |   |-- jwt.util.ts
|   |   |   |   +-- password.util.ts
|   |   |   |-- app.ts
|   |   |   +-- server.ts
|   |   |-- .env.example
|   |   |-- index.js
|   |   |-- package-lock.json
|   |   |-- package.json
|   |   +-- tsconfig.json
|   |-- vision-service/
|   |   |-- app/
|   |   |   |-- __init__.py
|   |   |   |-- __main__.py
|   |   |   |-- analysis.py
|   |   |   |-- config.py
|   |   |   |-- main.py
|   |   |   |-- models.py
|   |   |   |-- schemas.py
|   |   |   +-- security.py
|   |   |-- scripts/
|   |   |   +-- download_models.py
|   |   |-- tests/
|   |   |   |-- fixtures/
|   |   |   |   +-- images/
|   |   |   |       +-- README.md
|   |   |   |-- __init__.py
|   |   |   |-- test_analysis.py
|   |   |   |-- test_api.py
|   |   |   +-- test_security.py
|   |   |-- training/
|   |   |   |-- data.yaml
|   |   |   |-- evaluate.py
|   |   |   |-- export.py
|   |   |   |-- README.md
|   |   |   +-- train.py
|   |   |-- .dockerignore
|   |   |-- .env.example
|   |   |-- Dockerfile
|   |   |-- README.md
|   |   |-- requirements-dev.txt
|   |   +-- requirements.txt
|   |-- .dockerignore
|   |-- .env
|   |-- Dockerfile
|   |-- package-lock.json
|   |-- package.json
|   |-- seed.ts
|   +-- start-dev.ps1
|-- datasets/
|   |-- ecoalert-waste-v1/
|   |   |-- images/
|   |   |   |-- test/
|   |   |   |   +-- [437 image files; omitted]
|   |   |   |-- train/
|   |   |   |   +-- [3,391 image files; omitted]
|   |   |   +-- val/
|   |   |       +-- [412 image files; omitted]
|   |   |-- labels/
|   |   |   |-- test/
|   |   |   |   +-- [437 YOLO label files; omitted]
|   |   |   |-- train/
|   |   |   |   +-- [3,391 YOLO label files; omitted]
|   |   |   +-- val/
|   |   |       +-- [412 YOLO label files; omitted]
|   |   |-- data.yaml
|   |   |-- README.dataset.txt
|   |   +-- README.roboflow.txt
|   |-- incoming/
|   |   +-- EcoAlert_YOLO26_V1.zip
|   +-- ecoalert-waste-v1.zip
|-- docs/
|   |-- ai-evaluation/
|   |   |-- README.md
|   |   +-- vision-evaluation-template.csv
|   |-- notebooks/
|   |   +-- ecoalert-yolo26-training.ipynb
|   |-- ai-assistant.md
|   |-- ai-overall-incident-analysis.md
|   |-- cay-thu-muc-ma-nguon.md
|   |-- custom-yolo-deployment.md
|   |-- ecoalert-waste-dataset-guide.md
|   |-- huong-dan-cau-truc-chi-tiet.md
|   |-- p0-core-incident-workflow.md
|   |-- p1-operational-management.md
|   |-- phase-1-multimodal-vision.md
|   |-- phase-1-vision-ai.md
|   +-- phase-1a-multimodal-vision.md
|-- frontend/
|   |-- dist/
|   |   +-- [production build output; omitted]
|   |-- dist-prebuild-backup/
|   |   +-- [pre-build bundle backup; omitted]
|   |-- public/
|   |   |-- favicon.svg
|   |   +-- icons.svg
|   |-- src/
|   |   |-- assets/
|   |   |   |-- hero.png
|   |   |   |-- react.svg
|   |   |   +-- vite.svg
|   |   |-- components/
|   |   |   |-- auth/
|   |   |   |   +-- ProtectedRoute.tsx
|   |   |   |-- incidents/
|   |   |   |   |-- ConfirmActionDialog.tsx
|   |   |   |   |-- EvidenceGallery.tsx
|   |   |   |   |-- incident-status.tsx
|   |   |   |   |-- IncidentTimeline.tsx
|   |   |   |   |-- OverallAiAnalysisCard.tsx
|   |   |   |   +-- VisionAnalysisCard.tsx
|   |   |   |-- layout/
|   |   |   |   |-- DashboardLayout.tsx
|   |   |   |   |-- Sidebar.tsx
|   |   |   |   +-- Topbar.tsx
|   |   |   |-- location/
|   |   |   |   |-- CoordinateDisplay.tsx
|   |   |   |   |-- IncidentLocationDetails.tsx
|   |   |   |   |-- LocationActions.tsx
|   |   |   |   +-- LocationPickerModal.tsx
|   |   |   |-- map/
|   |   |   |   +-- HeatmapLayer.tsx
|   |   |   |-- reports/
|   |   |   |   |-- EvidenceUploader.tsx
|   |   |   |   |-- ReportFormStepper.tsx
|   |   |   |   |-- ReportPageHeader.tsx
|   |   |   |   +-- SelectedLocationCard.tsx
|   |   |   +-- ui/
|   |   |       |-- animated-counter.tsx
|   |   |       |-- app-toaster.tsx
|   |   |       |-- avatar.tsx
|   |   |       |-- badge.tsx
|   |   |       |-- button.tsx
|   |   |       |-- card.tsx
|   |   |       |-- dialog.tsx
|   |   |       |-- dropdown-menu.tsx
|   |   |       |-- empty-state.tsx
|   |   |       |-- input.tsx
|   |   |       |-- label.tsx
|   |   |       |-- language-toggle.tsx
|   |   |       |-- loading-spinner.tsx
|   |   |       |-- select.tsx
|   |   |       |-- skeleton.tsx
|   |   |       |-- sound-toggle.tsx
|   |   |       |-- stat-card.tsx
|   |   |       |-- tabs.tsx
|   |   |       |-- textarea.tsx
|   |   |       |-- theme-toggle.tsx
|   |   |       +-- tooltip.tsx
|   |   |-- contexts/
|   |   |   |-- AuthContext.tsx
|   |   |   |-- LanguageContext.tsx
|   |   |   |-- SocketContext.tsx
|   |   |   +-- ThemeContext.tsx
|   |   |-- features/
|   |   |   |-- admin/
|   |   |   |   |-- components/
|   |   |   |   |   |-- AdminLayout.tsx
|   |   |   |   |   |-- AdminSidebar.tsx
|   |   |   |   |   |-- AdminTopbar.tsx
|   |   |   |   |   +-- CreateUserModal.tsx
|   |   |   |   +-- pages/
|   |   |   |       |-- AdminDashboard.tsx
|   |   |   |       |-- AdminIncidentHeatmap.tsx
|   |   |   |       |-- AdminSettings.tsx
|   |   |   |       |-- Analytics.tsx
|   |   |   |       |-- AuditLogs.tsx
|   |   |   |       |-- CategoryManagement.tsx
|   |   |   |       |-- OfficerManagement.tsx
|   |   |   |       |-- ReportManagement.tsx
|   |   |   |       |-- SystemMonitoring.tsx
|   |   |   |       +-- UserManagement.tsx
|   |   |   |-- assistant/
|   |   |   |   |-- components/
|   |   |   |   |   |-- AssistantChat.tsx
|   |   |   |   |   |-- AssistantLauncher.tsx
|   |   |   |   |   |-- AssistantMessageBubble.tsx
|   |   |   |   |   +-- RoleAwareAssistantLayout.tsx
|   |   |   |   |-- hooks/
|   |   |   |   |   +-- useAssistantChat.ts
|   |   |   |   +-- pages/
|   |   |   |       +-- AssistantPage.tsx
|   |   |   |-- citizen/
|   |   |   |   |-- components/
|   |   |   |   |   |-- CategoryFilter.tsx
|   |   |   |   |   |-- CitizenFooter.tsx
|   |   |   |   |   |-- CitizenLayout.tsx
|   |   |   |   |   |-- CitizenNavbar.tsx
|   |   |   |   |   |-- EditReportModal.tsx
|   |   |   |   |   |-- HeroSection.tsx
|   |   |   |   |   |-- IncidentMap.tsx
|   |   |   |   |   |-- NearbyIncidents.tsx
|   |   |   |   |   |-- NewsSection.tsx
|   |   |   |   |   |-- StatsSection.tsx
|   |   |   |   |   |-- WeatherConditionIcon.tsx
|   |   |   |   |   +-- WeatherWidget.tsx
|   |   |   |   |-- hooks/
|   |   |   |   |   |-- useGeolocation.ts
|   |   |   |   |   +-- useWeather.ts
|   |   |   |   |-- pages/
|   |   |   |   |   |-- CitizenHome.tsx
|   |   |   |   |   |-- MyReports.tsx
|   |   |   |   |   +-- WeatherDetails.tsx
|   |   |   |   +-- services/
|   |   |   |       +-- weatherService.ts
|   |   |   +-- officer/
|   |   |       |-- components/
|   |   |       |   |-- OfficerLayout.tsx
|   |   |       |   |-- OfficerSidebar.tsx
|   |   |       |   +-- OfficerTopbar.tsx
|   |   |       +-- pages/
|   |   |           |-- AssignedReports.tsx
|   |   |           |-- OfficerDashboard.tsx
|   |   |           |-- OfficerMap.tsx
|   |   |           |-- OfficerNotifications.tsx
|   |   |           |-- OfficerReportDetail.tsx
|   |   |           |-- OfficerStats.tsx
|   |   |           +-- PendingVerification.tsx
|   |   |-- hooks/
|   |   |   |-- hooks.ts
|   |   |   +-- useSocket.ts
|   |   |-- lib/
|   |   |   |-- admin-incident-density.test.ts
|   |   |   |-- admin-incident-density.ts
|   |   |   |-- ai-confidence.ts
|   |   |   |-- api-error.ts
|   |   |   |-- audio-alert.ts
|   |   |   |-- gis-heatmap.test.ts
|   |   |   |-- gis-heatmap.ts
|   |   |   |-- incident-map-marker.ts
|   |   |   |-- maps.ts
|   |   |   |-- routes.ts
|   |   |   |-- utils.ts
|   |   |   |-- weather-details.test.ts
|   |   |   +-- weather-details.ts
|   |   |-- pages/
|   |   |   |-- AlertDetail.tsx
|   |   |   |-- CreateAlert.tsx
|   |   |   |-- Login.tsx
|   |   |   |-- Notifications.tsx
|   |   |   |-- Profile.tsx
|   |   |   +-- Register.tsx
|   |   |-- services/
|   |   |   |-- api.ts
|   |   |   |-- reverseGeocoder.ts
|   |   |   +-- services.ts
|   |   |-- types/
|   |   |   +-- index.ts
|   |   |-- App.css
|   |   |-- App.tsx
|   |   |-- index.css
|   |   |-- main.tsx
|   |   +-- vite-env.d.ts
|   |-- .env
|   |-- .gitignore
|   |-- .oxlintrc.json
|   |-- index.html
|   |-- package-lock.json
|   |-- package.json
|   |-- README.md
|   |-- tsconfig.json
|   |-- tsconfig.node.json
|   +-- vite.config.ts
|-- mobile/
|   |-- .claude/
|   |   +-- settings.json
|   |-- .expo/
|   |   +-- [local Expo state/cache; omitted]
|   |-- assets/
|   |   |-- android-icon-background.png
|   |   |-- android-icon-foreground.png
|   |   |-- android-icon-monochrome.png
|   |   |-- favicon.png
|   |   |-- icon.png
|   |   +-- splash-icon.png
|   |-- src/
|   |   |-- api/
|   |   |   |-- alertService.ts
|   |   |   |-- assistantService.ts
|   |   |   |-- authService.ts
|   |   |   |-- categoryService.ts
|   |   |   |-- client.ts
|   |   |   |-- gisService.ts
|   |   |   |-- notificationService.ts
|   |   |   |-- userService.ts
|   |   |   +-- weatherService.ts
|   |   |-- components/
|   |   |   |-- admin/
|   |   |   |   +-- OfficerPickerModal.tsx
|   |   |   |-- ai/
|   |   |   |   |-- OverallAiAnalysisCard.tsx
|   |   |   |   +-- VisionAnalysisCard.tsx
|   |   |   |-- modals/
|   |   |   |   |-- CategoryFormModal.tsx
|   |   |   |   |-- ChangePasswordModal.tsx
|   |   |   |   |-- CloseIncidentModal.tsx
|   |   |   |   |-- EditAlertModal.tsx
|   |   |   |   |-- EditProfileModal.tsx
|   |   |   |   |-- ResolutionModal.tsx
|   |   |   |   |-- RolePickerModal.tsx
|   |   |   |   +-- UserFormModal.tsx
|   |   |   |-- ui/
|   |   |   |   |-- Badge.tsx
|   |   |   |   |-- Button.tsx
|   |   |   |   |-- Card.tsx
|   |   |   |   |-- GlassCard.tsx
|   |   |   |   |-- InlineBanner.tsx
|   |   |   |   |-- Input.tsx
|   |   |   |   |-- SettingsSection.tsx
|   |   |   |   |-- Skeleton.tsx
|   |   |   |   +-- StatCard.tsx
|   |   |   +-- weather/
|   |   |       +-- WeatherCard.tsx
|   |   |-- context/
|   |   |   |-- LanguageContext.tsx
|   |   |   |-- SocketContext.tsx
|   |   |   +-- ThemeContext.tsx
|   |   |-- hooks/
|   |   |   |-- useAlerts.ts
|   |   |   |-- useAssistant.ts
|   |   |   |-- useAuth.ts
|   |   |   |-- useCategories.ts
|   |   |   |-- useDashboardLocation.ts
|   |   |   |-- useFormValidation.ts
|   |   |   |-- useGis.ts
|   |   |   |-- useLocation.ts
|   |   |   |-- useNotifications.ts
|   |   |   |-- useOfflineSync.ts
|   |   |   |-- useUsers.ts
|   |   |   +-- useWeather.ts
|   |   |-- i18n/
|   |   |   |-- en.ts
|   |   |   +-- vi.ts
|   |   |-- navigation/
|   |   |   |-- AdminTabNavigator.tsx
|   |   |   |-- CitizenTabNavigator.tsx
|   |   |   |-- OfficerTabNavigator.tsx
|   |   |   |-- RootNavigator.tsx
|   |   |   |-- TabNavigator.tsx
|   |   |   +-- types.ts
|   |   |-- screens/
|   |   |   |-- admin/
|   |   |   |   |-- AdminDashboardScreen.tsx
|   |   |   |   |-- AdminGisScreen.tsx
|   |   |   |   |-- AdminIncidentsScreen.tsx
|   |   |   |   |-- AdminMoreScreen.tsx
|   |   |   |   |-- AdminOfficerAvailabilityScreen.tsx
|   |   |   |   |-- AuditLogsScreen.tsx
|   |   |   |   |-- CategoryManagementScreen.tsx
|   |   |   |   +-- UserManagementScreen.tsx
|   |   |   |-- auth/
|   |   |   |   |-- LoginScreen.tsx
|   |   |   |   +-- RegisterScreen.tsx
|   |   |   |-- citizen/
|   |   |   |   |-- AlertDetailScreen.tsx
|   |   |   |   |-- AssistantScreen.tsx
|   |   |   |   |-- CitizenDashboardScreen.tsx
|   |   |   |   |-- MyReportsScreen.tsx
|   |   |   |   |-- NotificationsScreen.tsx
|   |   |   |   |-- ReportIncidentScreen.tsx
|   |   |   |   +-- WeatherDetailsScreen.tsx
|   |   |   |-- officer/
|   |   |   |   |-- OfficerAlertDetailScreen.tsx
|   |   |   |   |-- OfficerDashboardScreen.tsx
|   |   |   |   |-- OfficerMapScreen.tsx
|   |   |   |   +-- OfficerTasksScreen.tsx
|   |   |   |-- AlertDetailScreen.tsx
|   |   |   |-- index.ts
|   |   |   |-- LocationPickerScreen.tsx
|   |   |   +-- ReportIncidentScreen.tsx
|   |   |-- services/
|   |   |   |-- pushNotificationService.ts
|   |   |   +-- reverseGeocoder.ts
|   |   |-- types/
|   |   |   +-- index.ts
|   |   +-- utils/
|   |       |-- aiAnalysis.ts
|   |       |-- constants.ts
|   |       |-- maps.ts
|   |       |-- offlineQueue.ts
|   |       |-- storage.ts
|   |       |-- watermark.ts
|   |       +-- weather.ts
|   |-- .env
|   |-- .env.example
|   |-- .gitignore
|   |-- AGENTS.md
|   |-- app.json
|   |-- App.tsx
|   |-- CLAUDE.md
|   |-- index.ts
|   |-- LICENSE
|   |-- package-lock.json
|   |-- package.json
|   +-- tsconfig.json
|-- models/
|   +-- ecoalert-waste-yolo26n-v1.pt
|-- .env
|-- .gitignore
|-- CacDiemLuuYTrongCode.md
|-- docker-compose.infrastructure.yml
|-- docker-compose.yml
+-- tree.txt
```
