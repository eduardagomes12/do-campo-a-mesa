// Comprador: sala de leilão em tempo real
import { useEffect, useState } from 'react';
 import { useParams } from 'react-router-dom';
 import { useAuth } from '../context/AuthContext.jsx';
 import { useLeilao } from '../hooks/useLeilao.js';

 const moeda = (n) =>
   new Intl.NumberFormat('pt-PT', {
     style: 'currency',
     currency: 'EUR'
   }).format(Number(n) || 0);

 const dataPT = (data) => {
   if (!data) return '—';

   return new Date(data).toLocaleString('pt-PT', {
     dateStyle: 'short',
     timeStyle: 'short'
   });
 };

 function formatarTempo(segundos) {
   const total = Math.max(0, Math.floor(segundos));

   const dias = Math.floor(total / 86400);
   const horas = Math.floor((total % 86400) / 3600);
   const minutos = Math.floor((total % 3600) / 60);
   const segs = total % 60;

   const hora = [horas, minutos, segs]
     .map((n) => String(n).padStart(2, '0'))
     .join(':');

   return dias > 0 ? `${dias}d ${hora}` : hora;
 }

 export default function SalaLeilao() {
   const { id } = useParams();
   const { token, utilizador } = useAuth();

   const {
     leilao,
     atual,
     licitacoes,
     participantes,
     erro,
     ligado,
     aLicitar,
     resultado,
     agoraServidorMs,
     licitar
   } = useLeilao(id, token);

   const [valor, setValor] = useState('');
   const [erroFormulario, setErroFormulario] = useState('');

   const inicio = leilao
     ? new Date(leilao.iniciaEm).getTime()
     : 0;

   const fim = leilao
     ? new Date(leilao.terminaEm).getTime()
     : 0;

   const agendado = leilao?.estado === 'agendado';
   const terminado = leilao?.estado === 'terminado';

   const ativo = (
     leilao?.estado === 'ativo' &&
     agoraServidorMs >= inicio &&
     agoraServidorMs < fim
   );

   const segundosRestantes = leilao
     ? Math.ceil(
         Math.max(
           0,
           (agendado ? inicio : fim) - agoraServidorMs
         ) / 1000
       )
     : 0;

   const precoAtual = Number(
     atual?.valor ?? leilao?.precoBase ?? 0
   );

   const incremento = Number(leilao?.incremento ?? 0);

   const minimo = Math.round(
     (precoAtual + incremento) * 100
   ) / 100;



  // Atualizar automaticamente a sugestão de licitação mínima
  useEffect(() => {
    if (minimo > 0) {
      setValor(minimo.toFixed(2));
    }
  }, [id, minimo]);


   const comprador = utilizador?.papel === 'comprador';

   const podeLicitar = (
     comprador &&
     ativo &&
     ligado &&
     !aLicitar
   );

   const meuId = String(
     utilizador?._id ?? utilizador?.id ?? ''
   );

   const vencedorId = String(
     resultado?.vencedor ??
     leilao?.licitacaoAtual?.comprador ??
     ''
   );

   const souVencedor = (
     terminado &&
     vencedorId !== '' &&
     vencedorId === meuId
   );

   const nomeProdutor =
     leilao?.produtor?.produtor?.nomeExploracao ||
     leilao?.produtor?.nome;



    function preencherAtalho(acrescimo) {
      if (!podeLicitar) return;

      const novoValor = Math.round(
        (precoAtual + acrescimo) * 100
      ) / 100;

      // Respeitar sempre o incremento mínimo do leilão.
      if (novoValor < minimo) return;

      setValor(novoValor.toFixed(2));
      setErroFormulario('');
    }



    function submeter(e) {
      e.preventDefault();
      setErroFormulario('');

      const numero = Number(valor);

      if (
        !valor.trim() ||
        !Number.isFinite(numero) ||
        numero <= 0 ||
        Math.abs(numero * 100 - Math.round(numero * 100)) > 1e-6
      ) {
        setErroFormulario(
          'Introduz um valor válido com até duas casas decimais.'
        );
        return;
      }

      if (numero < minimo) {
        setErroFormulario(
          `A licitação mínima é ${moeda(minimo)}.`
        );
        return;
      }

      if (!podeLicitar) {
        setErroFormulario(
          'Não é possível licitar neste momento.'
        );
        return;
      }

      // Confirmar ofertas muito superiores ao mínimo.
      // Isto evita erros de introdução, sem impor
      // um limite máximo que não consta do enunciado.
      const ofertaElevada =
        numero >= minimo * 10 &&
        numero - minimo >= 100;

      if (ofertaElevada) {
        const confirmado = window.confirm(
          `Atenção! Estás prestes a licitar ${moeda(numero)}.\n\n` +
          `A oferta mínima é ${moeda(minimo)}.\n\n` +
          'Queres mesmo confirmar esta licitação?'
        );

        if (!confirmado) return;
      }

      // Enviar apenas UMA licitação ao servidor.
      licitar(numero);
    }

   if (!leilao) {
     return (
       <div className="card p-4">
         <h1 className="h4">Sala de leilão</h1>
         {erro ? (
           <div className="alert alert-warning" role="alert">
             {erro}
           </div>
         ) : (
           <p className="mb-0">
             A carregar os dados do leilão...
           </p>
         )}
       </div>
     );
   }

   return (
     <div className="row g-4">
       <section className="col-12 col-lg-8">
         <div className="card p-4 mb-4">
           <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
             <h1 className="h3 mb-0">{leilao.lote}</h1>

             <span className={
               `badge ${
                 terminado
                   ? 'text-bg-secondary'
                   : ativo
                     ? 'text-bg-success'
                     : 'text-bg-warning'
               }`
             }>
               {terminado
                 ? 'Terminado'
                 : ativo
                   ? 'Em direto'
                   : 'Agendado'}
             </span>
           </div>

           {leilao.descricao && (
             <p>{leilao.descricao}</p>
           )}

           {nomeProdutor && (
             <p className="mb-2">
               <strong>Produtor:</strong> {nomeProdutor}
             </p>
           )}

           {leilao.quantidade && (
             <p className="mb-2">
               <strong>Quantidade:</strong> {leilao.quantidade}
             </p>
           )}

           <p className="mb-2">
             <strong>Preço base:</strong>{' '}
             {moeda(leilao.precoBase)}
           </p>

           <p className="mb-2">
             <strong>Incremento mínimo:</strong>{' '}
             {moeda(leilao.incremento)}
           </p>

           <p className="mb-2">
             <strong>Início:</strong> {dataPT(leilao.iniciaEm)}
           </p>

           <p className="mb-0">
             <strong>Fim:</strong> {dataPT(leilao.terminaEm)}
           </p>
         </div>

         {/* Histórico das últimas 20 licitações */}
         <div className="card p-4">
           <div className="d-flex justify-content-between align-items-center mb-3">
             <h2 className="h5 mb-0">Histórico de licitações</h2>
             <span className="badge text-bg-light">
               {leilao.numLicitacoes ?? licitacoes.length} ofertas
             </span>
           </div>

           {licitacoes.length === 0 ? (
             <p className="texto-secundario mb-0">
               Ainda não existem licitações neste leilão.
             </p>
           ) : (
             <ul className="list-group list-group-flush">
               {licitacoes.map((bid, index) => (
                 <li
                   key={String(bid._id ?? index)}
                   className="list-group-item px-0"
                 >
                   <div className="d-flex justify-content-between gap-3">
                     <div>
                       <strong>{bid.nome || 'Comprador'}</strong>
                       <div className="small text-body-secondary">
                         {dataPT(bid.createdAt)}
                       </div>
                     </div>

                     <strong className="text-success">
                       {moeda(bid.valor)}
                     </strong>
                   </div>
                 </li>
               ))}
             </ul>
           )}
         </div>
       </section>

       <aside className="col-12 col-lg-4">
         <div className="card p-4">
           <div className="d-flex justify-content-between align-items-center mb-3">
             <span className="small">
               {participantes} a assistir
             </span>

             <span className={
               `badge ${
                 ligado
                   ? 'text-bg-success'
                   : 'text-bg-secondary'
               }`
             }>
               {ligado ? 'Ligado' : 'Desligado'}
             </span>
           </div>

           {/* Contagem decrescente sincronizada */}
           <p className="small text-body-secondary mb-1">
             {terminado
               ? 'Estado do leilão'
               : agendado
                 ? 'Começa dentro de'
                 : ativo
                   ? 'Termina dentro de'
                   : 'A aguardar encerramento'}
           </p>

           <div
             className="fs-3 fw-bold mb-3"
             aria-live="off"
           >
             {terminado
               ? 'Terminado'
               : formatarTempo(segundosRestantes)}
           </div>

           <hr />

           <p className="small text-body-secondary mb-1">
             Licitação atual
           </p>

           <p className="display-6 fw-bold text-success mb-3">
             {moeda(precoAtual)}
           </p>

           {!terminado && (
             <p className="small mb-3">
               Próxima oferta mínima:{' '}
               <strong>{moeda(minimo)}</strong>
             </p>
           )}

           {terminado ? (
             <div
               className={
                 `alert ${
                   souVencedor
                     ? 'alert-success'
                     : 'alert-secondary'
                 } mb-0`
               }
               role="status"
             >
               {souVencedor ? (
                 <>
                   <strong>Parabéns! Ganhaste o leilão!</strong>
                   <p className="mb-0 mt-2">
                     Oferta vencedora: {moeda(resultado?.valor ?? precoAtual)}.
                   </p>
                 </>
               ) : vencedorId ? (
                 <>
                   <strong>Leilão terminado.</strong>
                   <p className="mb-0 mt-2">
                     Vencedor: {atual?.nome || 'Comprador'}.
                     Valor final: {moeda(resultado?.valor ?? precoAtual)}.
                   </p>
                 </>
               ) : (
                 'O leilão terminou sem licitações.'
               )}
             </div>
           ) : comprador ? (
             <form onSubmit={submeter}>
               <label
                 htmlFor="valor"
                 className="form-label"
               >
                 O teu valor (€)
               </label>

               <input
                 id="valor"
                 type="number"
                 step="0.01"
                 min={minimo}
                 className="form-control mb-2"
                 value={valor}
                 onChange={(e) => {
                   setValor(e.target.value);
                   setErroFormulario('');
                 }}
                 disabled={!podeLicitar}
                 required
               />


                {/* Passo 7: atalhos rápidos de licitação */}
                <div className="mb-3">
                  <p className="small text-body-secondary mb-2">
                    Atalhos rápidos
                  </p>

                  <div className="d-flex flex-wrap gap-2">
                    {[5, 10, 25].map((acrescimo) => {
                      const valorSugerido = Math.round(
                        (precoAtual + acrescimo) * 100
                      ) / 100;

                      return (
                        <button
                          key={acrescimo}
                          type="button"
                          className="btn btn-outline-success flex-fill"
                          disabled={
                            !podeLicitar ||
                            valorSugerido < minimo
                          }
                          title={`Preencher ${moeda(valorSugerido)}`}
                          onClick={() => preencherAtalho(acrescimo)}
                        >
                          +{acrescimo} €
                        </button>
                      );
                    })}
                  </div>
                </div>

               <button
                 type="submit"
                 className="btn btn-success w-100"
                 disabled={!podeLicitar}
               >
                 {aLicitar
                   ? 'A confirmar licitação...'
                   : 'Licitar'}
               </button>

               {!ativo && (
                 <p className="small text-body-secondary mt-2 mb-0">
                   {agendado
                     ? 'As licitações ficam disponíveis quando o leilão abrir.'
                     : 'A aguardar atualização do estado do leilão.'}
                 </p>
               )}
             </form>
           ) : (
             <div className="alert alert-info mb-0">
               Podes acompanhar este leilão, mas apenas
               compradores podem licitar.
             </div>
           )}

           {(erroFormulario || erro) && (
             <div
               className="alert alert-warning mt-3 mb-0"
               role="alert"
             >
               {erroFormulario || erro}
             </div>
           )}
         </div>
       </aside>
     </div>
   );
 }
