import { checkNames, collectConfigNames } from './names.ts';

// Fails if any resolved Worker name (source config or the built config in dist/) is not
// hico-preview or hico-prod, or is one of the live apps hico, mec-trails, lume, lume-city.
let bad = false;
for (const { file, names } of collectConfigNames(process.cwd())) {
  const problems = checkNames(names);
  console.log(`${file}: ${names.join(', ')}  ${problems.length ? 'PROBLEM' : 'ok'}`);
  for (const p of problems) console.log(`  ${p}`);
  if (problems.length) bad = true;
}
process.exit(bad ? 1 : 0);
