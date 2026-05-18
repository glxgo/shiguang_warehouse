// 中国民航大学 正方教务适配脚本（DOM 解析）
// 支持校园网与 WebVPN 两种登录入口

const TimeSlots = [
    { number: 1, startTime: "08:00", endTime: "08:45" },
    { number: 2, startTime: "08:50", endTime: "09:35" },
    { number: 3, startTime: "10:05", endTime: "10:50" },
    { number: 4, startTime: "10:55", endTime: "11:40" },
    { number: 5, startTime: "13:30", endTime: "14:15" },
    { number: 6, startTime: "14:20", endTime: "15:05" },
    { number: 7, startTime: "15:35", endTime: "16:20" },
    { number: 8, startTime: "16:25", endTime: "17:10" },
    { number: 9, startTime: "18:30", endTime: "19:15" },
    { number: 10, startTime: "19:20", endTime: "20:05" }
];

function parseWeeks(weekStr) {
    if (!weekStr) return [];
    const segments = weekStr.split(',');
    let weeks = [];
    const segmentRegex = /(\d+)(?:-(\d+))?\s*周?(\([单双]\))?/g;
    for (const segment of segments) {
        segmentRegex.lastIndex = 0;
        let match;
        while ((match = segmentRegex.exec(segment)) !== null) {
            const start = parseInt(match[1]);
            const end = match[2] ? parseInt(match[2]) : start;
            const flagStr = match[3] || '';
            let flag = 0;
            if (flagStr.includes('单')) flag = 1;
            else if (flagStr.includes('双')) flag = 2;
            for (let i = start; i <= end; i++) {
                if (flag === 1 && i % 2 !== 1) continue;
                if (flag === 2 && i % 2 !== 0) continue;
                if (!weeks.includes(i)) weeks.push(i);
            }
        }
    }
    return weeks.sort((a, b) => a - b);
}

function parseSections(str) {
    const parts = str.split('-');
    const start = parseInt(parts[0]);
    const end = parseInt(parts[parts.length - 1]);
    if (isNaN(start) || isNaN(end) || start > end) return [];
    const result = [];
    for (let i = start; i <= end; i++) result.push(i);
    return result;
}

function parseGridZhengfang() {
    const $ = window.jQuery;
    if (!$) return [];

    const gridTable = document.getElementById('kbgrid_table_0');
    if (!gridTable) return [];

    const courses = [];
    $(gridTable).find('td.td_wrap').each(function () {
        const $td = $(this);
        if (!$td.text().trim()) return;

        const idParts = $td.attr('id');
        if (!idParts) return;
        const day = parseInt(idParts.split('-')[0]);
        if (isNaN(day) || day < 1 || day > 7) return;

        $td.find('.timetable_con.text-left').each(function () {
            const $course = $(this);
            const name = $course.find('.title font').text().replace(/[●★○]/g, '').trim();
            if (!name) return;

            const infoStr = $course.find('p').eq(0).find('font').eq(1).text().trim();
            const position = $course.find('p').eq(1).find('font').text().trim() || '';
            const teacher = $course.find('p').eq(2).find('font').text().trim() || '';

            const sectionMatch = infoStr.match(/\((\d+-\d+节)\)/);
            if (!sectionMatch) return;

            const sections = parseSections(sectionMatch[1].replace(/节/g, ''));
            const weekPart = infoStr.split('节)')[1] || '';
            const weeks = parseWeeks(weekPart.replace(/周/g, '').trim());

            if (name && sections.length && weeks.length) {
                courses.push({
                    name, day,
                    startSection: sections[0],
                    endSection: sections[sections.length - 1],
                    weeks,
                    teacher: teacher.replace(/教师 ：/g, '').trim(),
                    position: position.replace(/上课地点：/g, '').trim().split(/\s+/).pop() || ''
                });
            }
        });
    });

    return courses;
}

async function runImportFlow() {
    const confirmed = await window.AndroidBridgePromise.showAlert(
        "教务系统课表导入",
        "请确认：\n1. 已在教务系统中登录\n2. 已进入「个人课表查询」页面\n3. 已选择学年/学期并点击「查询」\n4. 课表已正常显示",
        "好的，开始导入"
    );
    if (!confirmed) { AndroidBridge.showToast("用户取消了导入。"); return; }

    AndroidBridge.showToast("正在解析页面课表数据...");

    const courses = parseGridZhengfang();

    if (courses.length === 0) {
        await window.AndroidBridgePromise.showAlert(
            "导入失败",
            "未能解析到课程数据。请确认已点击「查询」按钮且课表已显示在页面中。",
            "确定"
        );
        return;
    }

    await window.AndroidBridgePromise.saveImportedCourses(JSON.stringify(courses));
    await window.AndroidBridgePromise.savePresetTimeSlots(JSON.stringify(TimeSlots));

    AndroidBridge.showToast(`成功导入 ${courses.length} 门课程！`);
    AndroidBridge.notifyTaskCompletion();
}

runImportFlow();
