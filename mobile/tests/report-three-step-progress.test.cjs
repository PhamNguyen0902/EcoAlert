const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const reportDirectory = path.resolve(__dirname, '../src/citizen/report');
const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
const moduleValue = { exports: {} };
const source = fs.readFileSync(path.join(reportDirectory, 'components/ReportProgress.tsx'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
new Function('require', 'module', 'exports', js)(name => {
  if (name === 'react') return react;
  if (name === 'react-native') return { View: 'View', Text: 'Text', StyleSheet: { create: value => value } };
  if (name.endsWith('/fieldDesign')) return { fieldColors: { primary: '#22C55E', cyan: '#38BDF8' } };
  throw new Error(`Unexpected import: ${name}`);
}, moduleValue, moduleValue.exports);

function flatten(tree) {
  if (Array.isArray(tree)) return tree.flatMap(flatten);
  if (!tree || typeof tree !== 'object') return [tree];
  return [tree, ...flatten(tree.props.children)];
}

test('all progress states render exactly three segments with the correct text and accessibility range', () => {
  for (const [index, label] of ['Chụp ảnh', 'Kiểm tra', 'Gửi báo cáo'].entries()) {
    const tree = moduleValue.exports.ReportProgress({ step: index + 1 });
    assert.deepEqual(tree.props.accessibilityValue, { min: 1, max: 3, now: index + 1 });
    const nodes = flatten(tree);
    assert.ok(nodes.filter(value => typeof value === 'string' || typeof value === 'number').join('').includes(`${index + 1}/3 — ${label}`));
    const track = tree.props.children[1];
    assert.equal(track.props.children[0].length, 3);
    assert.equal(nodes.filter(value => typeof value === 'string' && /\/\s*0?4|trên 4/.test(value)).length, 0);
  }
});

test('active report screens assign capture=1, review/AI=2, confirm=3; GPS and success add no stage', () => {
  for (const [file, expected] of [
    ['ReportCameraScreen.tsx', [1]], ['ReportPhotoReviewScreen.tsx', [2]],
    ['ReportImageValidationScreen.tsx', [2]], ['ReportConfirmScreen.tsx', [3]],
    ['ReportLocationScreen.tsx', []], ['ReportSuccessScreen.tsx', []],
  ]) {
    const code = fs.readFileSync(path.join(reportDirectory, 'screens', file), 'utf8');
    const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const steps = [];
    function visit(node) {
      if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'ReportProgress') {
        const attribute = node.attributes.properties.find(prop => prop.name?.getText(ast) === 'step');
        steps.push(Number(attribute.initializer.expression.getText(ast)));
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.deepEqual(steps, expected, file);
  }
});
