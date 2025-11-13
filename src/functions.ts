import {inspect as stringify} from 'util';

type RequestErrorLike = {
  status?: number;
  response?: {
    data?: {
      message?: string;
      errors?: Array<{message?: string}>;
    };
  };
};

const NO_COMMITS_REGEX = /No commits between (\S+) and (\S+)/i;

function collectErrorMessages(error: unknown): string[] {
  const messages: string[] = [];

  if (error instanceof Error && error.message) {
    messages.push(error.message);
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as RequestErrorLike;
    const data = candidate.response?.data;

    if (data?.message) {
      messages.push(data.message);
    }

    const nestedErrors = data?.errors;

    if (Array.isArray(nestedErrors)) {
      for (const entry of nestedErrors) {
        if (entry?.message) {
          messages.push(entry.message);
        }
      }
    }
  }

  return messages;
}

function extractNoDiffDetails(error: unknown): {base: string; head: string} | undefined {
  const messages = collectErrorMessages(error);

  for (const message of messages) {
    const match = message.match(NO_COMMITS_REGEX);

    if (match?.[1] && match?.[2]) {
      const [, base, head] = match;

      return {base, head};
    }
  }

  return undefined;
}

export function getFriendlyErrorMessage(error: unknown): string {
  const noDiff = extractNoDiffDetails(error);

  if (noDiff) {
    const {base, head} = noDiff;

    return `Unable to create a merge-back pull request because '${head}' has no new commits compared to '${base}'. If the branches already match, you can skip rerunning this action or push new changes before retrying.`;
  }

  const defaultMessage = 'Failed to create the merge-back pull request.';
  const detail = error instanceof Error ? error.message : stringify(error, {depth: 2});

  return detail ? `${defaultMessage} ${detail}` : defaultMessage;
}

export function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
