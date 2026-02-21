const pts = [[40, 0], [60, 0], [60, 20], [80, 20], [80, 40], [100, 40], [100, 60], [80, 60], [80, 80], [60, 80], [60, 100], [40, 100], [40, 80], [20, 80], [20, 60], [0, 60], [0, 40], [20, 40], [20, 20], [40, 20]];
const r = 4;
let path = '';
for (let i = 0; i < pts.length; i++) {
    const p0 = pts[(i - 1 + pts.length) % pts.length];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];

    const v1 = [p1[0] - p0[0], p1[1] - p0[1]];
    const l1 = Math.hypot(v1[0], v1[1]);
    const u1 = [v1[0] / l1, v1[1] / l1];

    const v2 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l2 = Math.hypot(v2[0], v2[1]);
    const u2 = [v2[0] / l2, v2[1] / l2];

    const start = [p1[0] - r * u1[0], p1[1] - r * u1[1]];
    const end = [p1[0] + r * u2[0], p1[1] + r * u2[1]];

    const cross = u1[0] * u2[1] - u1[1] * u2[0];
    const sweep = cross > 0 ? 1 : 0;

    if (i === 0) path += 'M ' + start[0] + ' ' + start[1] + ' ';
    else path += 'L ' + start[0] + ' ' + start[1] + ' ';

    path += 'A ' + r + ' ' + r + ' 0 0 ' + sweep + ' ' + end[0] + ' ' + end[1] + ' ';
}
path += 'Z';
console.log(path);
