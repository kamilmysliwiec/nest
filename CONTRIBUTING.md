# Contributing to Nest

We would love for you to contribute to Nest and help make it even better than it is
today! As a contributor, here are the guidelines we would like you to follow:

<!--* [Code of Conduct](#coc)-->

- [Question or Problem?](#question)
- [Issues and Bugs](#issue)
- [Feature Requests](#feature)
- [Submission Guidelines](#submit)
- [Development Setup](#development)
- [Coding Rules](#rules)
- [Commit Message Guidelines](#commit)
  <!-- - [Signing the CLA](#cla) -->

<!-- ## <a name="coc"></a> Code of Conduct
Help us keep Nest open and inclusive. Please read and follow our [Code of Conduct][coc]. -->

## <a name="question"></a> Got a Question or Problem?

**Do not open issues for general support questions as we want to keep GitHub issues for bug reports and feature requests.** You've got much better chances of getting your question answered on [Stack Overflow](https://stackoverflow.com/questions/tagged/nestjs) where the questions should be tagged with tag `nestjs`.

Stack Overflow is a much better place to ask questions since:

<!-- - there are thousands of people willing to help on Stack Overflow [maybe one day] -->

- questions and answers stay available for public viewing so your question / answer might help someone else
- Stack Overflow's voting system assures that the best answers are prominently visible.

To save your and our time, we will systematically close all issues that are requests for general support and redirect people to Stack Overflow.

If you would like to chat about the question in real-time, you can reach out via [our discord channel][discord].

## <a name="issue"></a> Found a Bug?

If you find a bug in the source code, you can help us by
[submitting an issue](#submit-issue) to our [GitHub Repository][github]. Even better, you can
[submit a Pull Request](#submit-pr) with a fix.

## <a name="feature"></a> Missing a Feature?

You can _request_ a new feature by [submitting an issue](#submit-issue) to our GitHub
Repository. If you would like to _implement_ a new feature, please submit an issue with
a proposal for your work first, to be sure that we can use it.
Please consider what kind of change it is:

- For a **Major Feature**, first open an issue and outline your proposal so that it can be
  discussed. This will also allow us to better coordinate our efforts, prevent duplication of work,
  and help you to craft the change so that it is successfully accepted into the project. For your issue name, please prefix your proposal with `[discussion]`, for example "[discussion]: your feature idea".
- **Small Features** can be crafted and directly [submitted as a Pull Request](#submit-pr).

## <a name="submit"></a> Submission Guidelines

### <a name="submit-issue"></a> Submitting an Issue

Before you submit an issue, please search the issue tracker, maybe an issue for your problem already exists and the discussion might inform you of workarounds readily available.

We want to fix all the issues as soon as possible, but before fixing a bug we need to reproduce and confirm it. In order to reproduce bugs we will systematically ask you to provide a minimal reproduction scenario using a repository or [Gist](https://gist.github.com/). Having a live, reproducible scenario gives us wealth of important information without going back & forth to you with additional questions like:

- version of NestJS used
- 3rd-party libraries and their versions
- and most importantly - a use-case that fails

<!--
// TODO we need to create a playground, similar to plunkr

A minimal reproduce scenario using a repository or Gist allows us to quickly confirm a bug (or point out coding problem) as well as confirm that we are fixing the right problem. If neither of these are not a suitable way to demonstrate the problem (for example for issues related to our npm packaging), please create a standalone git repository demonstrating the problem. -->

<!-- We will be insisting on a minimal reproduce scenario in order to save maintainers time and ultimately be able to fix more bugs. Interestingly, from our experience users often find coding problems themselves while preparing a minimal plunk. We understand that sometimes it might be hard to extract essentials bits of code from a larger code-base but we really need to isolate the problem before we can fix it. -->

Unfortunately, we are not able to investigate / fix bugs without a minimal reproduction, so if we don't hear back from you we are going to close an issue that don't have enough info to be reproduced.

You can file new issues by filling out our [new issue form](https://github.com/nestjs/nest/issues/new).

### <a name="submit-pr"></a> Submitting a Pull Request (PR)

Before you submit your Pull Request (PR) consider the following guidelines:

<!--
To the first point

1. Please sign our [Contributor License Agreement (CLA)](#cla) before sending PRs.
We cannot accept code without this.
-->

1. Search [GitHub](https://github.com/nestjs/nest/pulls) for an open or closed PR
   that relates to your submission. You don't want to duplicate effort.
1. Fork the nestjs/nest repo.
1. Make your changes in a new git branch:

   ```shell
   git checkout -b my-fix-branch master
   ```

1. Create your patch, **including appropriate test cases**.
1. Follow our [Coding Rules](#rules).
1. Run the full Nest test suite (see [Development Setup](#development-setup)),
   and ensure that all tests pass.
1. Commit your changes using a descriptive commit message that follows our
   [commit message conventions](#commit). Adherence to these conventions
   is necessary because release notes are automatically generated from these messages.

   ```shell
   git commit -a
   ```

   Note: the optional commit `-a` command line option will automatically "add" and "rm" edited files.

1. Push your branch to GitHub:

   ```shell
   git push origin my-fix-branch
   ```

1. In GitHub, send a pull request to `nestjs:master`.

- If we suggest changes then:

  - Make the required updates.
  - Re-run the Nest test suites to ensure tests are still passing.
  - Rebase your branch and force push to your GitHub repository (this will update your Pull Request):

    ```shell
    git rebase master -i
    git push -f
    ```

That's it! Thank you for your contribution!

#### After your pull request is merged

After your pull request is merged, you can safely delete your branch and pull the changes
from the main (upstream) repository:

- Delete the remote branch on GitHub either through the GitHub web UI or your local shell as follows:

  ```shell
  git push origin --delete my-fix-branch
  ```

- Check out the master branch:

  ```shell
  git checkout master -f
  ```

- Delete the local branch:

  ```shell
  git branch -D my-fix-branch
  ```

- Update your master with the latest upstream version:

  ```shell
  git pull --ff upstream master
  ```

## <a name="development"></a> Development Setup

You will need Node.js version 8.9.0+.

1. After cloning the repo, run:

```bash
$ npm i # (or yarn install)
```

2. In order to prepare your environment run `prepare.sh` shell script:

```bash
$ sh scripts/prepare.sh
```

That will compile fresh packages and afterward, move them to all `sample` directories as well as integration tests.

### <a name="common-scripts"></a>Commonly used NPM scripts

```bash
# build all packages and move to "sample" directories
$ npm run build

# run the full unit tests suite
$ npm run test

# run integration tests
# docker is required(!)
$ sh scripts/run-integration.sh

# run linter
$ npm run lint

# build all packages and put them near to their source .ts files
$ npm run build:prod
```

## <a name="rules"></a> Coding Rules

To ensure consistency throughout the source code, keep these rules in mind as you are working:

<!--
// We're working on auto-documentation.
* All public API methods **must be documented**. (Details TBC). -->

- All features or bug fixes **must be tested** by one or more specs (unit-tests).
- We follow [Google's JavaScript Style Guide][js-style-guide], but wrap all code at
  **100 characters**. An automated formatter is available (`npm run format`).

## <a name="commit"></a> Commit Message Guidelines

We have very precise rules over how our git commit messages can be formatted. This leads to **more
readable messages** that are easy to follow when looking through the **project history**. But also,
we use the git commit messages to **generate the Nest change log**.

### Commit Message Format

Each commit message consists of a **header**, a **body** and a **footer**. The header has a special
format that includes a **type**, a **scope** and a **subject**:

```
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

The **header** is mandatory and the **scope** of the header is optional.

Any line of the commit message cannot be longer 100 characters! This allows the message to be easier
to read on GitHub as well as in various git tools.

Footer should contain a [closing reference to an issue](https://help.github.com/articles/closing-issues-via-commit-messages/) if any.

Samples: (even more [samples](https://github.com/nestjs/nest/commits/master))

```
docs(changelog): update change log to beta.5
fix(core): need to depend on latest rxjs and zone.js
```

### Revert

If the commit reverts a previous commit, it should begin with `revert:`, followed by the header of the reverted commit. In the body it should say: `This reverts commit <hash>.`, where the hash is the SHA of the commit being reverted.

### Type

Must be one of the following:

- **build**: Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)
- **chore**: Updating tasks etc; no production code change
- **ci**: Changes to our CI configuration files and scripts (example scopes: Travis, Circle, BrowserStack, SauceLabs)
- **docs**: Documentation only changes
- **feat**: A new feature
- **fix**: A bug fix
- **perf**: A code change that improves performance
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **test**: Adding missing tests or correcting existing tests
- **sample**: A change to the samples

### Scope

The scope should be the name of the npm package affected (as perceived by person reading changelog generated from commit messages.

The following is the list of supported scopes:

- **common**
- **core**
- **sample**
- **microservices**
- **testing**
- **websockets**

There are currently a few exceptions to the "use package name" rule:

- **packaging**: used for changes that change the npm package layout in all of our packages, e.g. public path changes, package.json changes done to all packages, d.ts file/format changes, changes to bundles, etc.
- **changelog**: used for updating the release notes in CHANGELOG.md
- **sample/#**: for the example apps directory, replacing # with the example app number
- none/empty string: useful for `style`, `test` and `refactor` changes that are done across all packages (e.g. `style: add missing semicolons`)
  <!-- * **aio**: used for docs-app (angular.io) related changes within the /aio directory of the repo -->

### Subject

The subject contains succinct description of the change:

- use the imperative, present tense: "change" not "changed" nor "changes"
- don't capitalize first letter
- no dot (.) at the end

### Body

Just as in the **subject**, use the imperative, present tense: "change" not "changed" nor "changes".
The body should include the motivation for the change and contrast this with previous behavior.

### Footer

The footer should contain any information about **Breaking Changes** and is also the place to
reference GitHub issues that this commit **Closes**.

**Breaking Changes** should start with the word `BREAKING CHANGE:` with a space or two newlines. The rest of the commit message is then used for this.

A detailed explanation can be found in this [document][commit-message-format].

<!-- ## <a name="cla"></a> Signing the CLA

Please sign our Contributor License Agreement (CLA) before sending pull requests. For any code
changes to be accepted, the CLA must be signed. It's a quick process, we promise!

* For individuals we have a [simple click-through form][individual-cla].
* For corporations we'll need you to
  [print, sign and one of scan+email, fax or mail the form][corporate-cla]. -->

<!-- [angular-group]: https://groups.google.com/forum/#!forum/angular -->

<!-- [coc]: https://github.com/angular/code-of-conduct/blob/master/CODE_OF_CONDUCT.md -->

[commit-message-format]: https://docs.google.com/document/d/1QrDFcIiPjSLDn3EL15IJygNPiHORgU1_OOAqWjiDU5Y/edit#
[corporate-cla]: http://code.google.com/legal/corporate-cla-v1.0.html
[dev-doc]: https://github.com/nestjs/nest/blob/master/docs/DEVELOPER.md
[github]: https://github.com/nestjs/nest
[discord]: https://discordapp.com/invite/G7Qnnhy
[individual-cla]: http://code.google.com/legal/individual-cla-v1.0.html
[js-style-guide]: https://google.github.io/styleguide/jsguide.html
[jsfiddle]: http://jsfiddle.net
[plunker]: http://plnkr.co/edit
[runnable]: http://runnable.com

<!-- [stackoverflow]: http://stackoverflow.com/questions/tagged/angular -->
