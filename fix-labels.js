const fs = require('fs');

function fixLabels(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/<label>([\s\S]*?)<\/label>/g, '<span class="info-label">$1</span>');
  fs.writeFileSync(filePath, content);
}

fixLabels('/Users/vetgo/smart-attendance/apps/portal/src/app/pages/branches/branch-detail.page.html');
fixLabels('/Users/vetgo/smart-attendance/apps/portal/src/app/pages/employees/employee-detail.page.html');
console.log("Done");
