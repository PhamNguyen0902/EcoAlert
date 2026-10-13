const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

const source = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/app/navigation/RootNavigator.tsx'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } },
).outputText;

function visibleRoutes(role) {
  const exports = {};
  const react = { ...React, default: React, useState: () => [true, () => {}], useEffect: () => {} };
  const modules = {
    react,
    'react-native': { View: 'View', ActivityIndicator: 'ActivityIndicator', StyleSheet: { create: x => x } },
    '@react-navigation/native-stack': { createNativeStackNavigator: () => ({ Navigator: 'Navigator', Screen: 'Screen' }) },
    '../../auth/screens/LoginScreen': { LoginScreen: 'LoginScreen' },
    '../../auth/screens/RegisterScreen': { RegisterScreen: 'RegisterScreen' },
    './CitizenTabNavigator': { CitizenTabNavigator: 'CitizenTabNavigator' },
    './OfficerTabNavigator': { OfficerTabNavigator: 'OfficerTabNavigator' },
    '../../auth/AdminMobileNoticeScreen': { AdminMobileNoticeScreen: 'AdminMobileNoticeScreen' },
    '../../shared/api/client': { setUnauthorizedCallback() {} },
    '../../shared/utils/constants': { COLORS: { primary: '#00A', background: '#000' } },
    '../../auth/hooks/useAuth': { useProfile: () => ({ data: role ? { role } : null, isLoading: false }), clearAuthQueryCache() {} },
    '@tanstack/react-query': { useQueryClient: () => ({}) },
  };
  vm.runInNewContext(source, { exports, require: id => {
    assert.ok(id in modules, `Unmocked import: ${id}`);
    return modules[id];
  } });
  const tree = exports.RootNavigator();
  const routes = [];
  function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    if (node.type === 'Screen') routes.push(node.props.name);
    walk(node.props?.children);
  }
  walk(tree);
  return routes;
}

test('mobile routes only recognized Citizen and Officer roles into their apps', () => {
  assert.deepEqual(visibleRoutes('CITIZEN'), ['CitizenApp']);
  assert.deepEqual(visibleRoutes('OFFICER'), ['OfficerApp']);
  assert.deepEqual(visibleRoutes('ADMIN'), ['AdminNotice']);
  assert.deepEqual(visibleRoutes('UNKNOWN'), ['AdminNotice']);
  assert.deepEqual(visibleRoutes(null), ['Login', 'Register', 'CitizenAppGuest']);
});
