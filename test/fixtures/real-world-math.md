# Applied Mathematics Field Notes

This document is a realistic mixture of prose, notation, operational notes,
and partially edited Markdown. It intentionally combines inline math such as
$E = mc^2$, LaTeX delimiters such as \(a^2 + b^2 = c^2\), and display
expressions that appear inside nested document structures.

The editorial budget is $120, the replacement sensor costs $45, and neither
currency value should be treated as mathematics. A literal escaped price
\$19.95 should remain ordinary text as well.

## 1. Measurement model

The sensor reports $y_i = \alpha x_i + \beta + \epsilon_i$, where
\(\epsilon_i \sim \mathcal{N}(0, \sigma^2)\). The calibration team uses
$\hat{\alpha}$ and $\hat{\beta}$ as the fitted parameters.

$$ calibration-v1
\hat{\theta}
=
\operatorname*{arg\,min}_{\theta}
\sum_{i=1}^{n}\left(y_i-f_{\theta}(x_i)\right)^2
$$

The review checklist is deliberately nested:

1. Validate acquisition.
   - Confirm the sample interval $\Delta t = 0.01\,\mathrm{s}$.
   - Compare the raw observation \(y_t\) with the filtered value
     \(\tilde{y}_t\).
   - Inspect three operating ranges:
     1. low load, where $0 \leq x < 0.25$;
     2. nominal load, where \(0.25 \leq x < 0.8\);
     3. peak load, where $0.8 \leq x \leq 1$.
2. Validate the estimator.
   - The residual is $r_i = y_i-\hat{y}_i$.
   - Its normalized form is \(\rho_i=r_i/\hat{\sigma}\).
   - For each batch:

     $$
     \operatorname{RMSE}
     =
     \sqrt{\frac{1}{n}\sum_{i=1}^{n}r_i^2}
     $$

3. Record uncertainty.
   - Aleatoric uncertainty uses $\sigma_a^2$.
   - Epistemic uncertainty uses \(\sigma_e^2\).
   - Total uncertainty is $u^2=\sigma_a^2+\sigma_e^2$.

> Review note: if \(\max_i |r_i| > 3\hat{\sigma}\), quarantine the batch.
>
> - First inspect $x_i$ for clipping.
> - Then compare \(r_i\) against the rolling median.
>   - A nested exception uses $\operatorname{MAD}(r)$.
>   - A severe exception satisfies \(r_i^2 > 9\sigma^2\).

## 2. Probability and inference

For a binary outcome, the likelihood is
$p(y\mid x,\theta)=\pi(x)^y(1-\pi(x))^{1-y}$ and the logit is
\(\log(\pi/(1-\pi))=w^\top x+b\).

\[
\log p(\theta\mid D)
=
\log p(D\mid\theta)+\log p(\theta)-\log p(D)
\]

The inference plan:

- Prior specification:
  - location $\mu_0=0$;
  - scale \(\tau_0=2.5\);
  - covariance $K_{ij}=k(x_i,x_j)$.
- Posterior checks:
  1. Calculate $\mathbb{E}[\theta\mid D]$.
  2. Estimate \(\operatorname{Var}(\theta\mid D)\).
  3. Compare quantiles $q_{0.05}$, $q_{0.5}$, and $q_{0.95}$.
- Predictive checks:
  - sample \(\tilde{y}\sim p(y\mid\tilde{x},\theta)\);
  - compute $T(\tilde{y})-T(y)$;
  - flag a discrepancy when \(p_\mathrm{ppc}<0.05\).

Inside a list item, a display equation remains part of the explanation:

- The Gaussian normalization constant is

  \[
  Z
  =
  \int_{-\infty}^{\infty}
  \exp\left(-\frac{(x-\mu)^2}{2\sigma^2}\right)\,dx
  =
  \sqrt{2\pi\sigma^2}.
  \]

  - The one-dimensional case uses $x\in\mathbb{R}$.
  - The multivariate case uses \(x\in\mathbb{R}^d\).
    - Its precision matrix is $\Lambda=\Sigma^{-1}$.
    - Its quadratic form is \(q=(x-\mu)^\top\Lambda(x-\mu)\).

## 3. Optimization notebook

Gradient descent updates $\theta_{k+1}=\theta_k-\eta_k g_k$. Momentum uses
\(v_{k+1}=\gamma v_k+g_k\) and $\theta_{k+1}=\theta_k-\eta v_{k+1}$.

$$
\mathcal{L}(\theta)
=
\frac{1}{m}\sum_{j=1}^{m}\ell(f_\theta(x_j),y_j)
+\lambda\lVert\theta\rVert_2^2
$$

Operational sequence:

1. Initialize $\theta_0$ with variance \(2/d_\mathrm{in}\).
2. For each epoch $e=1,\ldots,E$:
   1. Shuffle indices \(\pi_e\).
   2. Split into batches $B_1,\ldots,B_K$.
   3. For every batch:
      - evaluate $g_k=\nabla_\theta\mathcal{L}_{B_k}$;
      - clip with \(\tilde{g}_k=g_k\min(1,c/\lVert g_k\rVert)\);
      - update $\theta$ and the moving averages.
3. Stop when both conditions hold:
   - \(|\mathcal{L}_{k+1}-\mathcal{L}_k|<10^{-6}\);
   - $\lVert g_k\rVert_2<10^{-4}$.

> **Decision record.** We selected \(\eta_0=3\times10^{-4}\) because the
> larger candidate $10^{-3}$ oscillated near the saddle point.
>
> 1. Warmup lasts $500$ steps.
> 2. Cosine decay follows
>
>    $$
>    \eta_t
>    =
>    \eta_{\min}
>    +\frac{1}{2}(\eta_{\max}-\eta_{\min})
>    \left(1+\cos\frac{\pi t}{T}\right).
>    $$
>
> 3. Restarts occur at \(T_i=2^iT_0\).

## 4. Geometry and coordinate systems

Let $p=(x,y,z)^\top$ be expressed in frame $\mathcal{F}_A$. The rigid
transform into frame \(\mathcal{F}_B\) is $p_B=R_{BA}p_A+t_{BA}$.

\[
R_z(\phi)
=
\begin{bmatrix}
\cos\phi & -\sin\phi & 0\\
\sin\phi &  \cos\phi & 0\\
0        &  0        & 1
\end{bmatrix}.
\]

- Coordinate checks:
  - verify $\det R=1$;
  - verify \(R^\top R=I\);
  - bound the orthogonality error by $\lVert R^\top R-I\rVert_F<10^{-8}$.
- Projection checks:
  1. homogeneous point $\bar{p}=(x,y,z,1)^\top$;
  2. camera point \(p_c=T_{cw}\bar{p}\);
  3. image coordinate $u=f_xx_c/z_c+c_x$;
  4. image coordinate \(v=f_yy_c/z_c+c_y\).
- Nested failure handling:
  - if $z_c\leq0$, reject the point;
  - otherwise:
    - if \(u\notin[0,W)\), mark horizontal overflow;
    - if $v\notin[0,H)$, mark vertical overflow.

The area identity $A=\frac12 ab\sin\gamma$ agrees with
\(A=\sqrt{s(s-a)(s-b)(s-c)}\), where $s=(a+b+c)/2$.

## 5. Differential equations

The state equation is $\dot{x}=Ax+Bu$ and the observation equation is
\(y=Cx+Du\). For a stable continuous system, every eigenvalue satisfies
$\operatorname{Re}\lambda_i(A)<0$.

$$
x(t)
=
e^{At}x(0)
+\int_0^t e^{A(t-\tau)}Bu(\tau)\,d\tau
$$

Simulation checklist:

- Explicit Euler:
  - update $x_{n+1}=x_n+h f(t_n,x_n)$;
  - local error \(O(h^2)\);
  - global error $O(h)$.
- Runge--Kutta:
  1. $k_1=f(t_n,x_n)$;
  2. \(k_2=f(t_n+h/2,x_n+hk_1/2)\);
  3. $k_3=f(t_n+h/2,x_n+hk_2/2)$;
  4. \(k_4=f(t_n+h,x_n+hk_3)\);
  5. combine with

     \[
     x_{n+1}
     =
     x_n+\frac{h}{6}(k_1+2k_2+2k_3+k_4).
     \]

- Adaptive control:
  - estimate $e_n=\lVert x_n^{(5)}-x_n^{(4)}\rVert$;
  - accept when \(e_n\leq\mathrm{atol}+\mathrm{rtol}\lVert x_n\rVert\);
  - select $h_\mathrm{new}=0.9h(\mathrm{tol}/e_n)^{1/5}$.

## 6. Signal processing

For samples $x_0,\ldots,x_{N-1}$, the discrete Fourier transform is
\(X_k=\sum_{n=0}^{N-1}x_ne^{-i2\pi kn/N}\).

\[
S_{xx}(f)
=
\lim_{T\to\infty}
\frac{1}{T}\left|\int_{-T/2}^{T/2}x(t)e^{-i2\pi ft}\,dt\right|^2.
\]

Processing stages:

1. Remove the mean $\bar{x}=N^{-1}\sum_nx_n$.
2. Apply a Hann window
   \(w_n=\frac12(1-\cos(2\pi n/(N-1)))\).
3. Normalize the window energy $U=N^{-1}\sum_n w_n^2$.
4. Estimate bands:
   - low frequency: $0\leq f<10\,\mathrm{Hz}$;
   - mid frequency: \(10\leq f<100\,\mathrm{Hz}\);
   - high frequency: $100\leq f\leq f_s/2$.
5. For every band:
   - integrate \(P_B=\int_B S_{xx}(f)\,df\);
   - report $10\log_{10}(P_B/P_0)$;
   - retain phase \(\varphi_k=\arg X_k\).

> A narrow peak at $f_0=50\,\mathrm{Hz}$ is expected from mains coupling.
> Its second harmonic \(2f_0=100\,\mathrm{Hz}\) should remain below
> $-40\,\mathrm{dBc}$.

## 7. Statistical report

The sample mean is $\bar{x}=n^{-1}\sum_i x_i$ and the unbiased variance is
\(s^2=(n-1)^{-1}\sum_i(x_i-\bar{x})^2\).

$$
t
=
\frac{\bar{x}-\mu_0}{s/\sqrt{n}}
\sim t_{n-1}
$$

Report sections:

- Descriptive statistics:
  - median $m=q_{0.5}$;
  - interquartile range \(\operatorname{IQR}=q_{0.75}-q_{0.25}\);
  - skewness $g_1=m_3/m_2^{3/2}$;
  - kurtosis \(g_2=m_4/m_2^2-3\).
- Interval estimates:
  1. normal approximation $\bar{x}\pm z_{\alpha/2}s/\sqrt{n}$;
  2. bootstrap percentile interval \([q^*_{\alpha/2},q^*_{1-\alpha/2}]\);
  3. Bayesian credible interval $P(\theta\in I\mid D)=1-\alpha$.
- Multiple comparisons:
  - Bonferroni uses \(\alpha^\prime=\alpha/m\);
  - Benjamini--Hochberg orders $p_{(1)}\leq\cdots\leq p_{(m)}$;
  - select the largest \(k\) with $p_{(k)}\leq k\alpha/m$.

### 7.1 Nested audit list

- Experiment A:
  - group sizes $n_A=120$ and \(n_B=118\);
  - effect estimate $\hat{\delta}=0.42$;
  - standard error \(0.11\);
  - conclusion: $z=\hat{\delta}/\operatorname{SE}=3.82$.
- Experiment B:
  - cohorts:
    1. control with $n_0=80$;
    2. treatment one with \(n_1=83\);
    3. treatment two with $n_2=79$.
  - omnibus test:

    $$
    F
    =
    \frac{\operatorname{MS}_{\mathrm{between}}}
         {\operatorname{MS}_{\mathrm{within}}}.
    $$

  - follow-up contrasts use \(c^\top\mu=0\).

## 8. Markdown exclusion zones

The inline HTML code sample
<code>$code_sentinel$ \(\code_latex_sentinel\)</code> must stay literal.
The autolink <https://example.test/$autolink_sentinel$> must also stay
literal, as must the email-like address <math+$mail_sentinel$@example.test>.

~~~ts
const dollar = '$fenced_code_sentinel$'
const latex = "\\(fenced_latex_sentinel\\)"
const display = "\\[fenced_display_sentinel\\]"
~~~

    # Indented code is not mathematics either.
    result = "$indented_code_sentinel$ \(indented_latex_sentinel\)"

<span>$inline_html_sentinel$ \(\inline_html_latex_sentinel\)</span>

<div>
$html_block_sentinel$
\(\html_block_latex_sentinel\)
</div>

Outside those exclusion zones, $visible_after_code$ and
\(visible_after_html\) must still parse normally.

## 9. Links, emphasis, and editorial markup

The [regularized objective $J_\lambda$](https://example.test/objective) links
to a derivation. The **bold estimate $\hat{\theta}$** and the
*italic residual \(r_i\)* remain phrasing content. A nested phrase such as
***energy $E_k=\frac12mv^2$*** is also valid.

- Documentation links:
  - [gradient \(\nabla f\)](https://example.test/gradient);
  - [Hessian $H=\nabla^2f$](https://example.test/hessian);
  - [Jacobian \(J_{ij}=\partial f_i/\partial x_j\)](https://example.test/jacobian).
- Editorial annotations:
  - obsolete notation $x^\mathrm{old}$ is still parsed normally;
  - an image reference ![plot of $image_alt_sentinel$](plot.png) keeps its alt
    text opaque to the math tokenizer;
  - a hard break follows the norm \(\lVert x\rVert_2\).\
    The next line starts with $x_1$.

The display-style inline expression $$A^\top A+\lambda I$$ appears amid prose.
With display promotion enabled, the isolated expression below becomes a block:

$$B^\top B+\gamma I$$

The same applies to this isolated LaTeX display:

\[\operatorname{trace}(AB)=\operatorname{trace}(BA)\]

## 10. Nested operational runbook

1. **Pre-flight**
   1. Verify the model checksum $h(\theta)=h_\mathrm{expected}$.
   2. Verify feature dimensions:
      - numeric block \(x_n\in\mathbb{R}^{d_n}\);
      - categorical block $x_c\in\{0,1\}^{d_c}$;
      - concatenated input \(x=[x_n;x_c]\).
   3. Confirm normalization:

      $$
      z_j
      =
      \frac{x_j-\mu_j}{\max(\sigma_j,\epsilon)}.
      $$

2. **Canary**
   - Route $p_0=0.01$ of traffic.
   - Observe:
     - latency quantiles \(q_{0.5},q_{0.9},q_{0.99}\);
     - error rate $e=N_\mathrm{error}/N_\mathrm{total}$;
     - drift score \(\operatorname{PSI}(P,Q)\).
   - Escalate when:
     1. $q_{0.99}>250\,\mathrm{ms}$;
     2. \(e>0.005\);
     3. $\operatorname{PSI}>0.2$.

3. **Ramp**
   - Increase traffic according to \(p_k=\min(1,2^kp_0)\).
   - At each stage:
     - compare conversion $\Delta c=c_\mathrm{new}-c_\mathrm{old}$;
     - compare cost \(\Delta C=C_\mathrm{new}-C_\mathrm{old}\);
     - require the lower confidence bound $L_{\Delta c}>-\delta$.
   - Roll back with

     \[
     \theta_\mathrm{active}
     \leftarrow
     \theta_\mathrm{previous}
     \]

     if any guard fails.

4. **Post-flight**
   - Archive $n=10^4$ sampled requests.
   - Recompute \(\mathbb{E}[\ell]\) and $\operatorname{Var}(\ell)$.
   - Record the signed change $\Delta=\mathrm{metric}_{t+1}-\mathrm{metric}_t$.

## 11. Partially edited and malformed notes

Real documents contain abandoned delimiters. These fragments must remain text
without turning parsing quadratic:

- Draft inline fragments: \(draft_a, \(draft_b, \(draft_c, \(draft_d,
  \(draft_e, \(draft_f, \(draft_g, \(draft_h.
- Draft display fragments: \[matrix_a, \[matrix_b, \[matrix_c, \[matrix_d,
  \[matrix_e, \[matrix_f, \[matrix_g, \[matrix_h.
- Nested list of unfinished notes:
  1. first revision has \(alpha_1, \(alpha_2, \(alpha_3, \(alpha_4;
  2. second revision has \[beta_1, \[beta_2, \[beta_3, \[beta_4;
  3. mixed revision:
     - inline candidates \(gamma_1, \(gamma_2, \(gamma_3;
     - display candidates \[delta_1, \[delta_2, \[delta_3;
     - plain backslashes \\server\\share\\dataset are not openers.

After separate malformed list items, valid math still works in a new paragraph:
$recovered_dollar=1$, \(recovered_inline=2\), and \[recovered_display=3\].

> A quoted draft may also end with \(quoted_a, \(quoted_b, \(quoted_c.
>
> A separate quoted paragraph recovers with $q=4$ and \(r=5\).

## 12. Appendix: identities used in reviews

- Algebra:
  - $(a+b)^2=a^2+2ab+b^2$;
  - \((a-b)^2=a^2-2ab+b^2\);
  - $a^3-b^3=(a-b)(a^2+ab+b^2)$.
- Calculus:
  - \(\frac{d}{dx}x^n=nx^{n-1}\);
  - $\frac{d}{dx}\sin x=\cos x$;
  - \(\int e^x\,dx=e^x+C\);
  - $\int_0^1x^p\,dx=1/(p+1)$ for $p>-1$.
- Linear algebra:
  - \(\operatorname{rank}(AB)\leq\min(\operatorname{rank}A,\operatorname{rank}B)\);
  - $\det(AB)=\det(A)\det(B)$;
  - \(\lVert Ax\rVert_2\leq\lVert A\rVert_2\lVert x\rVert_2\);
  - $A=Q\Lambda Q^{-1}$ when $A$ is diagonalizable.
- Probability:
  - \(\mathbb{E}[X+Y]=\mathbb{E}[X]+\mathbb{E}[Y]\);
  - $\operatorname{Var}(aX+b)=a^2\operatorname{Var}(X)$;
  - \(\operatorname{Cov}(X,Y)=\mathbb{E}[XY]-\mathbb{E}[X]\mathbb{E}[Y]\);
  - $P(A\mid B)=P(B\mid A)P(A)/P(B)$.
- Information theory:
  - \(H(X)=-\sum_xp(x)\log p(x)\);
  - $D_\mathrm{KL}(P\Vert Q)=\sum_xP(x)\log(P(x)/Q(x))$;
  - \(I(X;Y)=H(X)+H(Y)-H(X,Y)\);
  - $H(X,Y)=H(X)+H(Y\mid X)$.

Final consistency equation:

$$
\underbrace{\mathcal{R}(\theta)}_{\text{risk}}
=
\underbrace{\mathcal{R}_{\mathrm{emp}}(\theta)}_{\text{fit}}
+\underbrace{\Omega(\theta)}_{\text{regularization}}
+\underbrace{\Delta_\mathrm{gen}}_{\text{generalization gap}}.
$$

The document ends with valid inline markers $end_dollar=1$ and
\(end_latex=2\), followed by ordinary prose.
