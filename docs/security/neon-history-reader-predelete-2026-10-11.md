# ChartNova — آرشیو تنظیمات نقش Neon پیش از حذف

**تاریخ استعلام:** 2026-10-11 20:08:59 UTC  
**پروژه Neon:** `still-shadow-40990313`  
**شاخه:** `production` (`br-small-hill-b5ff9d5x`)  
**پایگاه داده:** `neondb`  
**منبع:** پرس‌وجوی مستقیم فقط‌خواندنی از کاتالوگ‌های PostgreSQL و بررسی Bindingهای Worker در Cloudflare

> این فایل **آرشیو تنظیمات و شواهد دسترسی** است، نه نسخه قابل استفاده از اطلاعات اتصال. هیچ رمز، توکن یا `DATABASE_URL` در GitHub ذخیره نشده است. این فایل به‌هیچ‌وجه نباید برای ایجاد مجدد نقش پرمجوز استفاده شود.

## ۱. نقش قدیمی موردنظر برای حذف: `chartnova_history_reader`

| ویژگی PostgreSQL | مقدار ثبت‌شده |
|---|---|
| LOGIN | true |
| SUPERUSER | false |
| INHERIT | true |
| CREATEROLE | **true** |
| CREATEDB | **true** |
| REPLICATION | **true** |
| BYPASSRLS | **true** |
| CONNECTION LIMIT | -1 (بدون محدودیت تنظیم‌شده) |
| VALID UNTIL | null |
| عضویت در نقش دیگر | **neon_superuser** (بدون admin option) |
| عضوهای متکی به این نقش | ۰ |
| نشست فعال در زمان بررسی | ۰ |
| مالکیت جدول/نما | ۰ |
| مالکیت تابع | ۰ |
| مالکیت Schema | ۰ |
| مالکیت دیتابیس | ۰ |
| Default ACL متعلق به نقش | ۰ |
| وابستگی ثبت‌شده در `pg_shdepend` | ۰ |
| اعطای مستقیم روی جدول‌های عمومی در `information_schema.table_privileges` | موردی مشاهده نشد |

**نتیجه:** این نقش بیش از حد لازم قدرتمند است و به‌دلیل عضویت در `neon_superuser` می‌تواند به جدول‌های اصلی دسترسی داشته باشد؛ برای اتصال ChartNova به Worker نامناسب است. نقش `rolsuper=false` به‌تنهایی نشان‌دهنده کم‌اختیاری نیست.

## ۲. نقش جایگزین کم‌اختیار: `chartnova_history_ro`

| ویژگی PostgreSQL | مقدار ثبت‌شده |
|---|---|
| LOGIN | false — هنوز برای Worker فعال نشده |
| SUPERUSER / CREATEROLE / CREATEDB | false |
| INHERIT / REPLICATION / BYPASSRLS | false |
| عضویت در نقش دیگر | ندارد |
| نشست فعال هنگام بررسی | ۰ |
| SELECT روی `public.chartnova_history_public` | true |
| SELECT روی `public.market_ticks` | false |
| INSERT روی `public.market_ticks` | false |
| SELECT روی `public.candles` | false |

**تعریف قابل‌بازسازی نقش امن** به‌صورت جداگانه در `db/roles/chartnova_history_ro.sql` ثبت شده است. آن فایل جایگزین نقش پرمجوز قدیمی نیست و صرفاً برای بازیابی نقش امن زیر نظر مدیر دیتابیس است.

## ۳. بررسی وابستگی سرویس

- Worker: `velyqor-preview`
- Bindingهای مشاهده‌شده: `MARKET_CACHE`، `NAVASAN_API_KEY` و `OANOR_API_KEY`.
- Binding دیتابیس تاریخچه `CHARTNOVA_HISTORY_DATABASE_URL` مشاهده نشد.
- بنابراین هیچ نشانه‌ای از استفاده Worker مستقر از `chartnova_history_reader` در Bindingها وجود ندارد.
- با این حال اطلاعات اتصال موجود در هر سرویس خارجی خارج از محیط بررسی‌شده قابل رد قطعی نیست.

## ۴. سیاست نگهداری و پاک‌سازی

1. این snapshot در GitHub **قبل از حذف** ثبت و مجدداً خوانده شود.
2. از ذخیره یا انتقال رمز قبلی به GitHub خودداری شود. بازیابی یک نقش دارای LOGIN نیازمند تولید credential جدید در Neon و ذخیره امن آن در Cloudflare است.
3. عضویت در `neon_superuser`، `CREATEROLE`، `CREATEDB`، `REPLICATION` و `BYPASSRLS` صرفاً برای ممیزی تاریخی ثبت شده‌اند و **نباید خودکار بازیابی شوند**.
4. قبل از حذف، اتصال‌های خارجی احتمالی و نشست‌ها دوباره بررسی شوند؛ حذف فقط با تأیید صریح کارفرما انجام شود.
5. حذف نقش PostgreSQL، به‌خودی‌خود جدول‌های `market_ticks`، `candles` یا مشاهدات ECB را حذف نمی‌کند، مشروط به اینکه نقش مالک اشیای موردنیاز نباشد؛ وضعیت مالکیت در این snapshot صفر است.
6. با حذف نقش، رمز یا اتصال منتسب به آن دیگر قابل استفاده نیست؛ بازسازی بعدی بر اساس نقش امن کم‌اختیار انجام شود.

**وضعیت در زمان آرشیو:** نقش اضافی هنوز حذف نشده است. هیچ تغییری در نقش‌های Neon، Cloudflare یا استقرار Production در این مرحله اعمال نشده است.
