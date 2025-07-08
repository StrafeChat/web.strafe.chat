interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      date: string;
    };
  };
  html_url: string;
}

interface UpdateInfo {
  version: string;
  message: string;
  url: string;
  publishedAt: string;
  type: 'commit';
}

class GitHubService {
  private readonly owner = 'StrafeChat';
  private readonly repo = 'web.strafe.chat';
  private readonly apiBase = 'https://api.github.com';

  /**
   * Get the latest commit from the specified branch
   */
  async getLatestCommit(branch = 'dev'): Promise<GitHubCommit | null> {
    try {
      let response = await fetch(`${this.apiBase}/repos/${this.owner}/${this.repo}/commits/${branch}`);
      
      // If dev branch doesn't exist, try main
      if (!response.ok && response.status === 404 && branch === 'dev') {
        console.info('Dev branch not found, trying main branch');
        response = await fetch(`${this.apiBase}/repos/${this.owner}/${this.repo}/commits/main`);
        
        // If main doesn't exist either, try master
        if (!response.ok && response.status === 404) {
          console.info('Main branch not found, trying master branch');
          response = await fetch(`${this.apiBase}/repos/${this.owner}/${this.repo}/commits/master`);
        }
      }
      
      if (!response.ok) {
        console.warn('Failed to fetch latest commit:', response.status);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching latest commit:', error);
      return null;
    }
  }

  /**
   * Check for updates and return update information
   */
  async checkForUpdates(_currentVersion: string): Promise<UpdateInfo | null> {
    try {
      // Check for latest commit from dev branch (current) with fallback to main
      const commit = await this.getLatestCommit('dev');
      if (commit) {
        // For commits, we'll use a different strategy - check if it's newer than a day
        const commitDate = new Date(commit.commit.author.date);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        if (commitDate > oneDayAgo) {
          return {
            version: commit.sha.substring(0, 7), // Short SHA
            message: commit.commit.message,
            url: commit.html_url,
            publishedAt: commit.commit.author.date,
            type: 'commit'
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error checking for updates:', error);
      return null;
    }
  }


}

export const githubService = new GitHubService();
export type { UpdateInfo };