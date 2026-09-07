# skills — skill GLOBAL (dùng cho mọi workspace)

Chỉ đặt ở đây những skill **bạn muốn dùng toàn máy (mọi workspace)**.

- Thư mục con = 1 skill (có `SKILL.md`); `activate.ps1` sẽ copy tất cả thư mục con ở đây
  vào `~\.agents\skills\` (global) khi kích hoạt trên máy mới.
- **Skill chỉ dùng cho 1 workspace thì KHÔNG đưa vào đây** — chúng nằm ở
  `<workspace>\.agents\skills\` (vd `D:\PGĐ-Management\.agents\skills\...`) và chỉ áp dụng workspace đó.

### Quy tắc thêm skill global
Bạn chỉ định "lưu skill X vào global" → mình copy `~\.agents\skills\X` (hoặc nguồn) vào `skills\X`
kèm README mô tả, rồi commit.
