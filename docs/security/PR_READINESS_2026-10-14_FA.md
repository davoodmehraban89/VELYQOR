# VELYQOR — فهرست پذیرش PR و موانع انتشار

**تاریخ بررسی:** ۱۴ اکتبر ۲۰۲۶  
**محدوده:** بررسی خواندنی GitHub و نتایج واقعی CI. هیچ ادغام یا استقرار انجام نشده است.  
**مسئول اصلی:** هماهنگ‌کننده پروژه؛ بررسی فنی توسط حوزه QA/Release و ایمنی بازار داده.

## مبنای قابل‌ردیابی

- `main`: `29a45cff094658c7a2722fa6fa712bef061abb8c`
- آخرین ممیزی Windows در ۱۲ اکتبر: Worktree اصلی دارای ۹ فایل ویرایش‌شده و ۱۰۸۵ مسیر ثبت‌نشده بود. چهار Worktree آزمایشی دیگر نیز وجود داشتند. در بررسی ۱۴ اکتبر Desktop Commander آفلاین بود؛ **وضعیت محلی مجدداً کنترل نشده است**.
- Neon در آخرین بررسی تأییدشده: ۷۶۲ Reference Point مربوط به ECB، صفر Candle واقعی، و Migration شماره 0005 اعمال نشده است. این اعداد اسنپ‌شات تاریخی هستند، نه وضعیت لحظه‌ای ۱۴ اکتبر.

## جدول تصمیم درباره PRهای باز

| PR | آخرین وضعیت CI | وابستگی | تصمیم / معیار پذیرش |
|---|---|---|---|
| [#21](https://github.com/davoodmehraban89/VELYQOR/pull/21) | سبز؛ rerun دوم ۱۴ اکتبر | `main` | اصلاح Parser پاسخ Alpha Vantage؛ قبل از ادغام بازبینی کد و آزمون Negative Unit/Time؛ اثبات تازگی دائمی از CI قابل استنتاج نیست |
| [#22](https://github.com/davoodmehraban89/VELYQOR/pull/22) | سبز؛ rerun دوم ۱۴ اکتبر | `main` | Candidate Gold API؛ پذیرش کد از پذیرش Provider عملیاتی جدا باشد؛ Data Proof پیوسته، مجوز و محدودیت سهمیه لازم است |
| [#23](https://github.com/davoodmehraban89/VELYQOR/pull/23) | سبز؛ rerun دوم ۱۴ اکتبر | `feature/chartnova-neon-history` | Draft بماند؛ اتصال امن واقعی Neon Reader و اثبات حق OHLC/قوانین Gate لازم است؛ وابستگی Base باید قبل از ادغام مدیریت شود |
| [#24](https://github.com/davoodmehraban89/VELYQOR/pull/24) | سبز؛ rerun دوم ۱۲ اکتبر | `feature/chartnova-neon-direct-history` (PR #23) | Draft بماند؛ UI/WS فقط اسکلت تست‌شده است، نه Feeds عملیاتی؛ Staging، Publisher، Entitlement و ریسک انتشار باید مستقل تصویب شوند |
| [#25](https://github.com/davoodmehraban89/VELYQOR/pull/25) | سبز؛ `static-guard`، `verify` و `postgres-invariants` در ۱۴ اکتبر | `main` | Draft؛ کنترل فقط‌خواندنی P0 را پیشنهاد می‌کند؛ هنوز Required Check روی `main` نیست؛ بازبینی مالک پروژه قبل از Merge |
| [#26](https://github.com/davoodmehraban89/VELYQOR/pull/26) | سبز؛ `verify` و `postgres-invariants` در ۱۴ اکتبر | `main` | Draft؛ ایراد CWD در آزمون نبود Credentials اصلاح شد؛ رگرسیون مستقل ویندوز به‌علت آفلاین‌بودن دستگاه باقی است |

## مسیر بدون توقف

1. کدهای مستقل #21، #22 و #26 قابل بازبینی و تصمیم Merge هستند؛ موفقیت CI فقط پذیرش فنی اولیه است، نه تأیید بهره‌برداری منبع داده.
2. #25 باید برای ادغام حفاظتی مستقلاً بازبینی شود؛ پس از Merge و پیکربندی Required Check، حفاظت تغییرات آینده قوی‌تر می‌شود. اعمال Rule/Branch Protection به مجوز مشخص دسترسی نیاز دارد.
3. #23 و #24 وابستگی زنجیره‌ای دارند. ترتیب منطقی: ابتدا تعیین‌تکلیف Base #23، سپس #24. بدون Neon Credential با حداقل مجوز و تست End-to-End، ویژگی History مستقیم فعال نشود.
4. دریافت مجوز رسمی نگهداری و بازنشر Navasan `ohlcSearch` و تعیین واحد واقعی `usd_sell` و `18ayar` مانع مستقل خارج از GitHub است. با نبود شواهد `0005` نباید اجرا شود.
5. بازگشت اتصال Desktop Commander لازم است تا Worktree محلی، تست Windows و وضعیت Migration ثبت‌نشده واقعاً بررسی شوند. اجرای `git clean/reset/stash` بدون تصمیم مالک ممنوع است.

## گیت‌های بدون استثنا

- **NO LIVE ORDER:** AI یا Signal مجاز به ارسال مستقیم سفارش نیست؛ هر اتصال معاملاتی واقعی نیاز به معماری مستقل مدیریت سفارش/ریسک و تصویب صریح دارد.
- **NO FABRICATED DATA:** ECB Reference Point نباید به OHLC تبدیل نمایشی شود؛ داده مفقود نباید کندل ساختگی تولید کند.
- **NO UNLICENSED STORAGE/REDISTRIBUTION:** داشتن API Key، اثبات حق تجاری نیست.
- **NO PRODUCTION DEPLOYMENT:** موفقیت CI برابر انتشار نیست. Neon/Cloudflare/Domain و اسرار عملیاتی در این مرحله دست‌نخورده باقی بمانند.

## معیار پایان برای مرحله کنونی

تکمیل شده: بازبینی مجدد شش PR، شناسایی مانع‌های اصلی، اجرای مجدد CIهای قبلی، و ثبت گیت‌های P0 در Branch بررسی.  
تکمیل نشده: ادغام، اجرای تست مستقل Windows، تأیید حقوقی داده، اثبات Feed زنده، استقرار ایمن؛ این کارها نباید «Done» شوند.
