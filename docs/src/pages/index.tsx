import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--primary button--lg"
            to="/docs/installation">
            Install →
          </Link>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started"
            style={{marginLeft: '1rem'}}>
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}

function Feature({title, description, icon}: {title: string; description: string; icon: string}): ReactNode {
  return (
    <div className={clsx('col col--4', styles.feature)}>
      <div className="text--center">
        <div className={styles.featureIcon}>{icon}</div>
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          <Feature
            icon="🐳"
            title="Docker-in-Docker"
            description="Each workspace runs Docker inside a container, enabling full container development workflows and CI/CD testing."
          />
          <Feature
            icon="🤖"
            title="AI-Ready"
            description="Pre-installed Claude Code, OpenCode, and GitHub Copilot. Configure credentials once, use in all workspaces."
          />
          <Feature
            icon="🌍"
            title="Access Anywhere"
            description="Manage workspaces via Web UI, CLI, or TUI. SSH access from any machine. Work from laptop, desktop, or mobile."
          />
          <Feature
            icon="⚡"
            title="Fast Setup"
            description="One command to install, one to build, one to create a workspace. Start coding in minutes, not hours."
          />
          <Feature
            icon="🔒"
            title="Isolated & Safe"
            description="Complete isolation between workspaces. Experiment freely without affecting your host system or other projects."
          />
          <Feature
            icon="💾"
            title="Persistent Storage"
            description="Your code and data persist across restarts. Docker volumes ensure nothing is lost when containers stop."
          />
        </div>
      </div>
    </section>
  );
}

function CodeExample(): ReactNode {
  return (
    <section className={styles.codeExample}>
      <div className="container">
        <div className="row">
          <div className="col col--6">
            <Heading as="h2">Simple, Powerful CLI</Heading>
            <p>
              Workspace provides a clean command-line interface for managing development environments.
              Create, start, stop, and delete workspaces with simple commands.
            </p>
            <p>
              Each workspace is a complete Ubuntu environment with Docker, Node.js, Python, and all
              your favorite tools pre-installed.
            </p>
          </div>
          <div className="col col--6">
            <div className={styles.codeBlock}>
              <pre>
                <code>{`# Install
npm install -g @subroutinecom/workspace

# Build base image
ws build

# Start agent
ws agent start

# Create workspace
ws create myproject --clone git@github.com:user/repo.git

# Access via SSH
ssh -p 2201 workspace@localhost

# Or use the web UI
open http://localhost:8420`}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CallToAction(): ReactNode {
  return (
    <section className={styles.cta}>
      <div className="container">
        <div className="row">
          <div className="col col--12 text--center">
            <Heading as="h2">Ready to get started?</Heading>
            <p className={styles.ctaSubtitle}>
              Create your first containerized development workspace in minutes.
            </p>
            <div className={styles.buttons}>
              <Link
                className="button button--primary button--lg"
                to="/docs/installation">
                Install →
              </Link>
              <Link
                className="button button--secondary button--lg"
                to="https://github.com/subroutinecom/workspace"
                style={{marginLeft: '1rem'}}>
                GitHub
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title="Home"
      description="Containerized development environments with Docker-in-Docker, SSH access, and AI coding assistants">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <CodeExample />
        <CallToAction />
      </main>
    </Layout>
  );
}
