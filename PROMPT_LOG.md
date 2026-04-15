# PROMPT_LOG.md — Nhật ký làm việc với AI IDE

> Ghi lại mọi prompt quan trọng + cách review/refine. Đây là **một trong những phần được chấm điểm** của bài thi (15% AI workflow).

---

## Cách dùng file này

Mỗi entry theo format:

```markdown
## [#XX] <Mục tiêu ngắn gọn>
- **Date:** YYYY-MM-DD
- **Tool:** Claude Code | Cursor | Copilot
- **Module:** auth | attendance | dashboard | ...
- **Phase:** spec | scaffolding | feature | bugfix | refactor | test | docs

### Mục tiêu
<1-2 câu mô tả muốn AI làm gì>

### Prompt
\`\`\`
<paste prompt thực tế đã gửi>
\`\`\`

### AI sinh ra
<tóm tắt: file/function nào, dùng pattern gì>

### Vấn đề phát hiện khi review
- ...
- ...

### Cách chỉnh sửa
- ...

### Kết quả cuối cùng
- Commit: `<hash>` hoặc PR `#NN`
- Test: pass/fail
- Note: <điều rút ra>
```

---

## Nguyên tắc ghi log

1. **Không ghi đối phó.** Tránh format kiểu "Prompt 1: tạo login → xong". Phải có review + chỉnh sửa.
2. **Ghi cả prompt fail.** Khi AI sinh sai, ghi lại để rút kinh nghiệm prompt sau.
3. **Ghi quyết định KHÔNG dùng AI.** Vd: "Tự viết trust score logic vì AI hiểu sai weight" — cũng là AI workflow tốt.
4. **Tham chiếu commit/PR.** Mỗi entry có thể trace về code thực tế.
5. **Phân loại theo phase** để cuối kỳ tổng kết.

---

## Bài học chung (cập nhật dần)

- AI hay sinh `findMany()` không có `take` → luôn nhắc pagination trong prompt
- AI hay quên guard role → review từng controller endpoint
- AI hay thêm dependency lạ → check `package.json` diff
- AI hay viết comment kiểu "// added for X" → xóa hết khi review
- (thêm dần khi gặp)

---

# ENTRIES

---

## [#01] Khởi tạo spec + ERD + API contract
- **Date:** 2026-04-15
- **Tool:** Claude Code (Opus 4.6)
- **Module:** docs
- **Phase:** spec

### Mục tiêu
Phân tích đề bài + tạo bộ tài liệu nền: `spec.md`, `erd.md`, `api-spec.md`, `CLAUDE.md`, `PROMPT_LOG.md`, `README.md`.

### Prompt
```
giúp tôi phân tích bài tập README.MD
Công nghệ: ionic + nestjs + prisma
IONIC build web portal + app cho người dùng
dùng nx, postgres cho database
đánh giá phân tích resarch1.md
→ chúng ta cần làm spec trước
→ viết tài liệu giúp tôi
→ tiếp tục theo thứ tự ưu tiên
```

### AI sinh ra
- `docs/spec.md` (14 mục, ~470 dòng): rule nghiệp vụ, trust score, anti-fraud, scale strategy, MVP scope
- `docs/erd.md` (10 mục): Mermaid ERD + Prisma schema đầy đủ + index strategy + partition plan
- `docs/api-spec.md` (13 mục): convention, 8 module API với request/response + error catalog
- `CLAUDE.md`: context file cho AI IDE — conventions, structure, forbidden list
- `PROMPT_LOG.md`: file này
- `README.md`: khung dự án

### Vấn đề phát hiện khi review
- (chờ team review)
- Cần verify Capacitor plugin Wi-Fi cho iOS/Android trước ngày 2
- Schema chưa migration thực tế — cần `prisma migrate dev` để confirm

### Cách chỉnh sửa
- (cập nhật khi review xong)

### Kết quả cuối cùng
- Commit: (chưa)
- Test: N/A (docs)
- Note: Bộ tài liệu này là **đầu vào bắt buộc** cho mọi prompt sau. Mỗi feature mới phải reference spec/api-spec.

---

<!-- Thêm entry mới ở dưới đây -->

## [#02] <Tiếp theo: scaffolding Nx workspace>
- **Date:**
- **Tool:**
- **Module:**
- **Phase:**

### Mục tiêu

### Prompt
```
```

### AI sinh ra

### Vấn đề phát hiện khi review

### Cách chỉnh sửa

### Kết quả cuối cùng
