/* MiniMart landing — loads store info + open roles from the public API.
   All user/DB-driven text is inserted via textContent (never innerHTML) so
   job data can't inject markup into the page. */
(function () {
  'use strict';

  var grid = document.getElementById('jobs-grid');
  var skeleton = document.getElementById('jobs-skeleton');
  var emptyBox = document.getElementById('jobs-empty');

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function money(n, currency) {
    if (n === null || n === undefined) return '';
    var sym = currency === 'PHP' ? '₱' : (currency + ' ');
    return sym + Number(n).toLocaleString();
  }

  function closingLabel(isoDate) {
    if (!isoDate) return null;
    var d = new Date(isoDate + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var days = Math.round((d - today) / 86400000);
    if (days < 0) return 'Closed';
    if (days === 0) return 'Closes today';
    if (days === 1) return 'Closes tomorrow';
    if (days <= 14) return 'Closes in ' + days + ' days';
    return 'Closes ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
  }

  function applyJobCard(job, currency) {
    var li = document.createElement('li');
    li.className = 'job-card';

    var top = document.createElement('div');
    top.className = 'job-top';

    var h3 = document.createElement('h3');
    h3.className = 'job-title';
    h3.textContent = job.title || 'Untitled role';
    top.appendChild(h3);

    var badges = document.createElement('div');
    badges.style.display = 'flex';
    badges.style.gap = '8px';
    if (job.department && job.department.name) {
      var dept = document.createElement('span');
      dept.className = 'badge badge-dept';
      dept.textContent = job.department.name;
      badges.appendChild(dept);
    }
    if (job.employmentType) {
      var type = document.createElement('span');
      type.className = 'badge badge-type';
      type.textContent = job.employmentType;
      badges.appendChild(type);
    }
    top.appendChild(badges);
    li.appendChild(top);

    if (job.description) {
      var desc = document.createElement('p');
      desc.className = 'job-desc';
      desc.textContent = job.description;
      li.appendChild(desc);
    }

    var meta = document.createElement('div');
    meta.className = 'job-meta';
    var metaItems = [];
    if (job.salaryMin || job.salaryMax) {
      metaItems.push([
        '💰',
        (job.salaryMin && job.salaryMax)
          ? money(job.salaryMin, currency) + ' – ' + money(job.salaryMax, currency) + '/mo'
          : money(job.salaryMin || job.salaryMax, currency) + '/mo',
      ]);
    }
    if (job.location) metaItems.push(['📍', job.location]);
    if (job.openings > 1) metaItems.push(['👥', job.openings + ' openings']);
    var closing = closingLabel(job.closingDate);
    if (closing) metaItems.push(['🗓️', closing]);
    metaItems.forEach(function (m) {
      var span = document.createElement('span');
      var icon = document.createElement('span');
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = m[0];
      span.appendChild(icon);
      span.appendChild(document.createTextNode(m[1]));
      meta.appendChild(span);
    });
    if (metaItems.length) li.appendChild(meta);

    var btn = document.createElement('a');
    btn.className = 'btn btn-outline';
    btn.href = '/hrms/careers';
    btn.textContent = 'Apply at careers portal →';
    li.appendChild(btn);

    grid.appendChild(li);
  }

  function injectJobLd(jobs) {
    if (!jobs.length) return;
    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'jobs-jsonld';
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'JobPosting',
      'jobLocationType': 'ON_SITE',
      'datePosted': new Date().toISOString().split('T')[0],
      'validThrough': (function () {
        var max = jobs.map(function (j) { return j.closingDate; }).filter(Boolean).sort().pop();
        return max || new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];
      })(),
      'description': 'Open roles at MiniMart. See the careers portal for full details.',
      'applicantLocationRequirements': 'PH',
      'jobLocation': {
        '@type': 'Place',
        'address': { '@type': 'PostalAddress', 'addressCountry': 'PH' },
      },
      'title': 'Open roles at MiniMart',
    });
    document.head.appendChild(script);
  }

  function loadJobs() {
    return fetch('/api/v1/public/jobs', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (payload) {
        var jobs = (payload && payload.data && payload.data.jobs) || [];
        jobs.forEach(function (job) { applyJobCard(job, 'PHP'); });
        injectJobLd(jobs);
        if (jobs.length === 0) {
          emptyBox.hidden = false;
        } else {
          emptyBox.hidden = true;
        }
      })
      .catch(function () {
        emptyBox.hidden = false;
        var p = emptyBox.querySelector('p');
        if (p) p.textContent = 'We could not load the latest roles right now — please refresh the page.';
      });
  }

  function applySettings(s) {
    if (!s) return;
    var name = s.storeName || 'MiniMart';
    ['brand-name', 'footer-name', 'footer-name-2'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.textContent = name;
    });
    document.title = name + ' — Your Neighborhood Store';
    var ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', name + ' — Your Neighborhood Store');

    if (s.address) {
      var fact = document.getElementById('fact-address');
      if (fact) fact.textContent = s.address; // the 📍 icon is a sibling span in the markup
      var va = document.getElementById('visit-address');
      if (va) va.textContent = '📍 ' + s.address;
    }
    if (s.phone) {
      var vp = document.getElementById('visit-phone');
      if (vp) vp.textContent = '📞 ' + s.phone;
    }
    if (s.email) {
      var ve = document.getElementById('visit-email');
      if (ve) ve.textContent = '✉️ ' + s.email;
      var mail = emptyBox.querySelector('a[href^="mailto:"]');
      if (mail) mail.href = 'mailto:' + s.email;
      var vn = document.getElementById('visit-name');
      if (vn) vn.textContent = name;
    }

    // Keep the schema.org block in sync with real store data.
    try {
      var org = JSON.parse(document.getElementById('org-jsonld').textContent);
      org.name = name;
      if (s.address) org.address.streetAddress = s.address;
      if (s.phone) org.telephone = s.phone;
      if (s.email) org.email = s.email;
      document.getElementById('org-jsonld').textContent = JSON.stringify(org, null, 2);
    } catch (e) { /* non-fatal */ }
  }

  function loadSettings() {
    return fetch('/api/v1/public/settings', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (payload) { applySettings(payload && payload.data); })
      .catch(function () { /* static defaults stay */ });
  }

  document.getElementById('year').textContent = String(new Date().getFullYear());
  Promise.all([loadSettings(), loadJobs()]).finally(function () {
    skeleton.style.display = 'none';
  });
})();
