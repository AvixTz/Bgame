# העלאת Bgame לשרת

## איך זה בנוי

```
GitHub (main)  ──push──▶  GitHub Actions: בדיקות + בנייה  ──SSH/rsync──▶  השרת שלך: nginx מגיש קבצים סטטיים
```

המשחק הוא אתר סטטי: HTML, JS, CSS ופונטים, בערך 2.7MB, ו-כ-700KB בהורדה דחוסה. בשרת אין Node, אין PHP ואין מסד נתונים. כל ההתקדמות של הילדים נשמרת בדפדפן של כל מכשיר, כך שאין בשרת מידע אישי לגבות או לאבטח.

כל העלאה נכנסת לתיקייה חדשה (`/var/www/bgame/releases/<תאריך>`), והקישור `current` עובר אליה בפעולה אחת. אין רגע שבו האתר חצי-מעודכן, ו-5 הגרסאות האחרונות נשמרות לחזרה אחורה.

האתר חי לצד אתרים אחרים באותו שרת (למשל n8n): זה בלוק `server` נפרד ב-nginx עם דומיין משלו, והוא לא נוגע בהגדרות הקיימות.

## מה צריך ממך (פעם אחת)

| # | מה | דוגמה | איפה |
|---|---|---|---|
| 1 | דומיין או תת-דומיין למשחק | `bgame.example.co.il` | אצל רשם הדומיין |
| 2 | רשומת DNS מסוג A (ו-AAAA אם יש IPv6) שמצביעה ל-IP של השרת | `bgame → 1.2.3.4` | ממשק ה-DNS |
| 3 | גישת SSH לשרת עם משתמש שיש לו sudo | | |
| 4 | שרת Debian/Ubuntu, פורטים 80 ו-443 פתוחים בחומת האש | `sudo ufw allow 'Nginx Full'` | בשרת / בפאנל של ספק השרת |
| 5 | כתובת מייל להתראות של תעודת ה-SSL | | |
| 6 | הרשאה להוסיף Secrets ב-GitHub לרפו `AvixTz/Bgame` | | GitHub → Settings |

## התקנה (פעם אחת, כ-15 דקות)

### שלב 1: DNS
צור רשומת A לתת-הדומיין שבחרת, שמצביעה ל-IP של השרת. בדיקה מהמחשב: `ping bgame.example.co.il` מחזיר את ה-IP של השרת. (לפעמים לוקח כמה דקות.)

### שלב 2: הכנת השרת
בשרת, כמשתמש עם sudo:

```bash
git clone https://github.com/AvixTz/Bgame.git ~/bgame-setup
cd ~/bgame-setup
sudo bash deploy/setup-server.sh bgame.example.co.il you@example.com
```

הסקריפט מתקין nginx ו-certbot, יוצר משתמש `deploy` (בלי סיסמה, רק מפתח SSH, ויכול לכתוב רק לתיקיית המשחק), מתקין את הגדרת האתר ומוציא תעודת HTTPS חינמית שמתחדשת לבד. בסוף, `https://bgame.example.co.il` מציג "המשחק יעלה בקרוב".

אם השרת מאחורי Cloudflare או שה-DNS עוד לא מוכן: `SKIP_TLS=1 sudo bash deploy/setup-server.sh ...`, ואחר כך `sudo certbot --nginx -d bgame.example.co.il`.

### שלב 3: מפתח העלאה
על המחשב שלך (לא בשרת):

```bash
ssh-keygen -t ed25519 -N "" -C "bgame-deploy" -f bgame_deploy
```

נוצרים שני קבצים. את **הציבורי** (`bgame_deploy.pub`) מדביקים בשרת:

```bash
sudo tee -a /home/deploy/.ssh/authorized_keys < bgame_deploy.pub
```

ואת טביעת האצבע של השרת שומרים לשלב הבא:

```bash
ssh-keyscan -p 22 bgame.example.co.il
```

### שלב 4: Secrets ב-GitHub
ב-`github.com/AvixTz/Bgame` → Settings → Secrets and variables → Actions:

| שם | ערך |
|---|---|
| `DEPLOY_HOST` | כתובת השרת (IP או hostname) |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | כל התוכן של הקובץ **הפרטי** `bgame_deploy` |
| `DEPLOY_KNOWN_HOSTS` | הפלט של `ssh-keyscan` משלב 3 |
| `DEPLOY_PORT` | רק אם SSH לא על 22 |

ובלשונית Variables: `DEPLOY_URL` = `https://bgame.example.co.il/`

המפתח הפרטי נשמר רק ב-GitHub Secrets. לא בקוד, לא במייל, לא בצ'אט. אחרי שהדבקת אותו אפשר למחוק את הקובץ מהמחשב.

רשות: ב-Settings → Environments → production אפשר להוסיף "Required reviewers", ואז כל העלאה מחכה לאישור שלך בלחיצה.

### שלב 5: ההעלאה הראשונה
ממזגים את הענף לענף `main` (דרך PR ב-GitHub). המיזוג מפעיל את ההעלאה אוטומטית: בדיקת תוכן, בדיקת טיפוסים, 54 בדיקות, בנייה, ואז העלאה ובדיקה שהאתר עונה. אפשר לעקוב בלשונית Actions. אפשר גם להפעיל ידנית: Actions → deploy → Run workflow.

## מהיום והלאה

- **עדכון:** כל מיזוג ל-`main` עולה לשרת לבד בתוך 2-4 דקות. אם בדיקה נכשלת, כלום לא עולה והאתר נשאר בגרסה הקודמת.
- **חזרה לגרסה קודמת** (מכל מחשב עם המפתח):
  ```bash
  DEPLOY_HOST=<server> bash deploy/rollback.sh            # הגרסה הקודמת
  DEPLOY_HOST=<server> bash deploy/rollback.sh <שם-גרסה>  # גרסה מסוימת
  ```
  או בשרת עצמו: `ls /var/www/bgame/releases` ואז `sudo -u deploy ln -sfn releases/<שם> /var/www/bgame/current`.
- **העלאה ידנית בלי GitHub:** `npm ci && npm run build`, ואז `DEPLOY_HOST=<server> bash deploy/deploy.sh`.

## בדיקה אחרי העלאה

- [ ] `https://` נפתח, המנעול ירוק, ו-`http://` מפנה ל-`https://`
- [ ] האי נטען בטלפון ובמחשב, והדמות זזה
- [ ] פונטים בעברית נראים עגולים (Fredoka/Rubik), לא Arial
- [ ] "חכמים יותר" → מילה → "השתמשתי במילה" → הקלטה: הדפדפן מבקש רשות למיקרופון, וההקלטה מתנגנת
- [ ] "סיפור לילה" → "הקרא לי" מקריא (תלוי בקול עברי במכשיר)
- [ ] רענון דף באמצע משחק לא מאבד התקדמות

## אבטחה ופרטיות (אתר לילדים)

- הפונטים מוגשים מהשרת שלך. אין שום בקשה לגוגל או לצד שלישי בזמן משחק, וזה מה שמאפשר מדיניות CSP נוקשה.
- ב-nginx מוגדרים: CSP (קוד רק מהאתר עצמו), חסימת הטמעה באתרים זרים, `Referrer-Policy: no-referrer`, והרשאת מיקרופון רק לאתר עצמו. מצלמה ומיקום חסומים.
- אין עוגיות, אין אנליטיקס ואין טפסים שנשלחים לשרת. ההקלטות הקוליות לא יוצאות מהמכשיר.
- משתמש `deploy` יכול לכתוב רק לתיקיית המשחק, בלי sudo.
- לוגים: `/var/log/nginx/bgame.access.log`. הם כוללים כתובות IP, ומומלץ לשמור אותם תקופה קצרה (logrotate ברירת מחדל: 14 יום).

## תקלות נפוצות

| מה רואים | למה | מה עושים |
|---|---|---|
| certbot נכשל | ה-DNS עוד לא מצביע לשרת, או שפורט 80 סגור | `ping` לדומיין, `sudo ufw allow 'Nginx Full'`, ולהריץ שוב |
| ה-Action נכשל ב-Deploy עם `Permission denied (publickey)` | המפתח הציבורי לא ב-`authorized_keys`, או שהפרטי לא הודבק במלואו | להדביק שוב, כולל שורות BEGIN/END |
| `Host key verification failed` | `DEPLOY_KNOWN_HOSTS` חסר או ישן | להריץ שוב `ssh-keyscan` ולעדכן |
| דף לבן | גרסה חלקית או שגיאת JS | `rollback.sh`, ולבדוק את הקונסול בדפדפן |
| המיקרופון לא עובד | האתר ב-http ולא ב-https | להשלים את certbot |
| אחרי עדכון רואים גרסה ישנה | קאש של הדפדפן | `index.html` מוגדר no-cache, אז רענון רגיל מספיק. אם לא: לבדוק שהגדרת nginx מהרפו היא זו שבשימוש |

## מה נבדק לפני שזה הגיע אליך

כל התהליך הורץ על שרת מדומה (nginx + SSH עם משתמש deploy): הסקריפט `setup-server.sh`, שתי העלאות, מעבר אטומי בין גרסאות, rollback, כותרות האבטחה והקאש, ו-playtest מלא של המשחק מאחורי ה-CSP (כולל פונטים והקלטה) בלי אף חסימה.

## הצעד הבא (פרודקשן מלא)

כשנרצה שההתקדמות תעבור בין מכשירים ושהורים יראו את הילדים מכל מקום, נוסיף שרת נתונים (Supabase או Postgres בשרת שלך) עם חשבון משפחה. זה פרויקט נפרד שכולל מדיניות פרטיות והסכמת הורים, ואין צורך בו כדי להעלות את המשחק עכשיו.
