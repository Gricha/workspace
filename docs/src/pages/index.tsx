import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  return (
    <header className={styles.heroBanner}>
      <div className={styles.heroContent}>
        <Heading as="h1" className={styles.heroTitle}>
          Perry
        </Heading>
        <p className={styles.heroSubtitle}>
          Self-hosted dev containers, accessible anywhere
        </p>
        <p className={styles.heroTagline}>
          <span>Docker</span> workspaces with <span>SSH</span>, <span>Web UI</span>, and <span>AI coding tools</span> built in
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--primary button--lg"
            to="/docs/installation">
            Get Started
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="https://github.com/gricha/perry">
            View on GitHub
          </Link>
        </div>
        <div className={styles.terminalPrompt}>
          <span>perry start myproject --clone git@github.com:user/repo.git</span>
          <span className={styles.cursor}></span>
        </div>
      </div>
    </header>
  );
}

const features = [
  {
    icon: '01',
    title: 'AI-Ready Environments',
    description: 'Claude Code, OpenCode, and Codex CLI pre-installed. Configure once, use everywhere.',
  },
  {
    icon: '02',
    title: 'Self-Hosted Control',
    description: 'Run on your hardware. Your code, your data, your infrastructure.',
  },
  {
    icon: '03',
    title: 'Remote Access',
    description: 'Work from anywhere via Tailscale. Web UI, CLI, or SSH - your choice.',
  },
  {
    icon: '04',
    title: 'Docker-in-Docker',
    description: 'Full Docker support inside each workspace. Containerize within containers.',
  },
  {
    icon: '05',
    title: 'Persistent Storage',
    description: 'Your code and data survive restarts. Named volumes keep everything safe.',
  },
  {
    icon: '06',
    title: 'Zero Configuration',
    description: 'One command to install, one to start. SSH keys and credentials sync automatically.',
  },
];

function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <Heading as="h2" className={styles.sectionTitle}>
          Why Perry?
        </Heading>
        <p className={styles.sectionSubtitle}>
          Everything you need for isolated, reproducible development environments.
        </p>
        <div className={styles.featureGrid}>
          {features.map((feature) => (
            <div key={feature.title} className={styles.feature}>
              <div className={styles.featureIcon}>{feature.icon}</div>
              <div className={styles.featureTitle}>{feature.title}</div>
              <p className={styles.featureDescription}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RemoteAccess(): ReactNode {
  return (
    <section className={styles.remoteAccess}>
      <div className="container">
        <Heading as="h2" className={styles.sectionTitle}>
          Access From Anywhere
        </Heading>
        <p className={styles.sectionSubtitle}>
          Work from your phone, tablet, or any browser via Tailscale.
        </p>
        <div className={styles.demoGrid}>
          <div className={styles.demoItem}>
            <img src="/img/demo-terminal-mobile.gif" alt="Terminal on mobile" />
            <p>Mobile terminal</p>
          </div>
          <div className={styles.demoItem}>
            <img src="/img/demo-chat-mobile.gif" alt="AI chat on mobile" />
            <p>AI sessions on the go</p>
          </div>
        </div>
        <div className={styles.demoWeb}>
          <img src="/img/demo.gif" alt="Web UI demo" />
          <p>Full Web UI for desktop</p>
        </div>
      </div>
    </section>
  );
}

function CodeExample(): ReactNode {
  return (
    <section className={styles.codeExample}>
      <div className={styles.codeExampleInner}>
        <div className={styles.codeExampleText}>
          <Heading as="h2">Simple, Powerful CLI</Heading>
          <p>
            Clean command-line interface for managing isolated development environments.
            Create, start, stop, and access workspaces with intuitive commands.
          </p>
          <p>
            Each workspace is a complete Ubuntu environment with Node.js, Python, Go,
            Docker, and all your favorite development tools pre-installed.
          </p>
        </div>
        <div className={styles.codeBlock}>
          <div className={styles.codeBlockHeader}>
            <span className={styles.codeBlockDot}></span>
            <span className={styles.codeBlockDot}></span>
            <span className={styles.codeBlockDot}></span>
            <span className={styles.codeBlockTitle}>terminal</span>
          </div>
          <pre>
            <code>
              <span className={styles.codeComment}># Install Perry</span>{'\n'}
              <span className={styles.codeCommand}>curl</span> <span className={styles.codeFlag}>-fsSL</span> https://raw.githubusercontent.com/gricha/perry/main/install.sh | bash{'\n'}
              {'\n'}
              <span className={styles.codeComment}># Start the agent</span>{'\n'}
              <span className={styles.codeCommand}>perry</span> agent run{'\n'}
              {'\n'}
              <span className={styles.codeComment}># Create a workspace with your repo</span>{'\n'}
              <span className={styles.codeCommand}>perry</span> start myproject <span className={styles.codeFlag}>--clone</span> <span className={styles.codeString}>git@github.com:user/repo.git</span>{'\n'}
              {'\n'}
              <span className={styles.codeComment}># Connect via shell</span>{'\n'}
              <span className={styles.codeCommand}>perry</span> shell myproject{'\n'}
              {'\n'}
              <span className={styles.codeComment}># Or open Web UI</span>{'\n'}
              <span className={styles.codeCommand}>open</span> http://localhost:7391
            </code>
          </pre>
        </div>
      </div>
    </section>
  );
}

function CallToAction(): ReactNode {
  return (
    <section className={styles.cta}>
      <div className={styles.ctaContent}>
        <Heading as="h2" className={styles.ctaTitle}>
          Ready to get started?
        </Heading>
        <p className={styles.ctaSubtitle}>
          Create your first containerized development workspace in under a minute.
        </p>
        <div className={styles.buttons}>
          <Link
            className="button button--primary button--lg"
            to="/docs/installation">
            Install Perry
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started">
            Quick Start Guide
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout
      title="Isolated Development Workspaces"
      description="Docker containers with SSH access, AI coding assistants, and Tailscale integration. Self-hosted, remote-accessible development environments.">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <RemoteAccess />
        <CodeExample />
        <CallToAction />
      </main>
    </Layout>
  );
}
