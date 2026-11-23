#!/usr/bin/env node
/*
 * Olympiad paper checker. Run after any generate-*.js script:
 *   node tools/check-papers.js            # report problems
 *   node tools/check-papers.js --balance  # also spread correct answers evenly over A–D
 *
 * Reports: missing answers, answer index out of range, duplicate options,
 * and papers where more than half the correct answers sit on the same option
 * (a child could score well by always tapping "A").
 * --balance reshuffles options only in those skewed papers (deterministic per file),
 * never moving questions whose options say "all of / none of / both / above / below".
 */
"use strict";
var fs = require("fs");
var path = require("path");

var DATA = path.join(__dirname, "..", "data");
var BALANCE = process.argv.indexOf("--balance") !== -1;
var POSITIONAL = /all of|none of|both|above|below/i;

function seeded(str) {
  var h = 2166136261;
  for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return function () {
    h += 0x6d2b79f5;
    var t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rnd) {
  for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  return arr;
}
function getKey(ans, id) { return Array.isArray(ans) ? ans[id - 1] : ans[String(id)]; }
function setKey(ans, id, v) { if (Array.isArray(ans)) ans[id - 1] = v; else ans[String(id)] = v; }
function write(file, obj, orig) { fs.writeFileSync(file, JSON.stringify(obj, null, 2) + (/\n$/.test(orig) ? "\n" : "")); }

var problems = 0, balanced = 0, papers = 0;
fs.readdirSync(DATA).filter(function (c) { return /^class\d+$/.test(c); }).forEach(function (cls) {
  fs.readdirSync(path.join(DATA, cls)).forEach(function (subj) {
    var qDir = path.join(DATA, cls, subj, "questions");
    if (!fs.existsSync(qDir)) return;
    fs.readdirSync(qDir).filter(function (f) { return /\.json$/.test(f); }).forEach(function (f) {
      var qFile = path.join(qDir, f), aFile = path.join(DATA, cls, subj, "answers", f);
      var tag = cls + "/" + subj + "/" + f;
      papers++;
      if (!fs.existsSync(aFile)) { console.log(tag + ": missing answers file"); problems++; return; }
      var qRaw = fs.readFileSync(qFile, "utf8"), aRaw = fs.readFileSync(aFile, "utf8");
      var qj = JSON.parse(qRaw), aj = JSON.parse(aRaw);
      var qs = qj.questions || [], ans = aj.answers;

      qs.forEach(function (q) {
        var k = getKey(ans, q.id), o = q.options || [];
        if (typeof k !== "number" || k < 0 || k >= o.length) { console.log(tag + " q" + q.id + ": bad answer " + JSON.stringify(k)); problems++; }
        if (new Set(o.map(String)).size !== o.length) { console.log(tag + " q" + q.id + ": duplicate options " + JSON.stringify(o)); problems++; }
      });

      var counts = {};
      qs.forEach(function (q) { var k = getKey(ans, q.id); counts[k] = (counts[k] || 0) + 1; });
      var top = Math.max.apply(null, Object.keys(counts).map(function (k) { return counts[k]; }).concat([0]));
      if (qs.length < 10 || top / qs.length <= 0.5) return;

      if (!BALANCE) { console.log(tag + ": " + top + "/" + qs.length + " answers on the same option (run with --balance)"); problems++; return; }
      var rnd = seeded(tag);
      var movable = qs.filter(function (q) {
        return q.options && q.options.length === 4 && !q.options.some(function (o) { return POSITIONAL.test(String(o)); });
      });
      var targets = shuffle(movable.map(function (_, i) { return i % 4; }), rnd);
      movable.forEach(function (q, i) {
        var k = getKey(ans, q.id), right = q.options[k];
        var others = shuffle(q.options.filter(function (_, j) { return j !== k; }), rnd);
        others.splice(targets[i], 0, right);
        q.options = others;
        setKey(ans, q.id, targets[i]);
      });
      write(qFile, qj, qRaw);
      write(aFile, aj, aRaw);
      balanced++;
    });
  });
});
console.log(papers + " papers checked, " + problems + " problem(s)" + (BALANCE ? ", " + balanced + " rebalanced" : ""));
process.exitCode = problems ? 1 : 0;
