
export interface GithubConfig {
  repo: string;
  token: string;
  owner: string;
  repoName: string;
}

export async function pushToGithub(config: GithubConfig, path: string, content: string, message: string = 'Update from app') {
  try {
    const { owner, repoName, token } = config;
    const url = `https://api.github.com/repos/${owner}/${repoName}/contents/${path}`;

    // Get current file to get SHA (if exists)
    let sha: string | undefined;
    try {
      const resp = await fetch(url, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (resp.status === 200) {
        const data = await resp.json();
        sha = data.sha;
      }
    } catch (e) {
      console.log("File might not exist yet, continuing...");
    }

    const body = {
      message,
      content: btoa(content), // Base64 encode
      sha
    };

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to push to GitHub');
    }

    return await response.json();
  } catch (error) {
    console.error('Github Sync Error:', error);
    throw error;
  }
}

export function parseGithubUrl(url: string) {
  try {
    const parts = url.replace('https://github.com/', '').split('/');
    return {
      owner: parts[0],
      repoName: parts[1]
    };
  } catch (e) {
    return null;
  }
}
