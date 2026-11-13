import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';

// Formulário para editar os dados públicos da exploração.
export default function EditarExploracao() {
  const { utilizador, token, guardarSessao } = useAuth();

  const exploracao = utilizador?.produtor || {};

  const [campos, setCampos] = useState(() => ({
    nomeExploracao: exploracao.nomeExploracao || '',
    descricao: exploracao.descricao || '',
    localidade: exploracao.localidade || '',
    lat: exploracao.localizacao?.lat?.toString() || '',
    lng: exploracao.localizacao?.lng?.toString() || ''
  }));

  const [aGuardar, setAGuardar] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  function alterar(e) {
    const { name, value } = e.target;

    setCampos((anterior) => ({
      ...anterior,
      [name]: value
    }));

    setErro('');
    setSucesso('');
  }

  async function guardar(e) {
    e.preventDefault();

    if (aGuardar || !token) return;

    setErro('');
    setSucesso('');

    const nomeExploracao = campos.nomeExploracao.trim();
    const descricao = campos.descricao.trim();
    const localidade = campos.localidade.trim();
    const latTexto = campos.lat.trim();
    const lngTexto = campos.lng.trim();

    if (!nomeExploracao || !localidade) {
      setErro('Preenche o nome da exploração e a localidade.');
      return;
    }

    if (Boolean(latTexto) !== Boolean(lngTexto)) {
      setErro('Preenche as duas coordenadas ou deixa ambas vazias.');
      return;
    }

    let localizacao = null;

    if (latTexto && lngTexto) {
      const lat = Number(latTexto.replace(',', '.'));
      const lng = Number(lngTexto.replace(',', '.'));

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        setErro('Introduz coordenadas válidas.');
        return;
      }

      localizacao = { lat, lng };
    }

    setAGuardar(true);

    try {
      const atualizado = await api('/producers/me', {
        metodo: 'PATCH',
        token,
        corpo: {
          nomeExploracao,
          descricao,
          localidade,
          localizacao
        }
      });

      // Atualizar também a sessão do React.
      guardarSessao({
        token,
        utilizador: atualizado
      });

      const dados = atualizado.produtor || {};

      setCampos({
        nomeExploracao: dados.nomeExploracao || '',
        descricao: dados.descricao || '',
        localidade: dados.localidade || '',
        lat: dados.localizacao?.lat?.toString() || '',
        lng: dados.localizacao?.lng?.toString() || ''
      });

      setSucesso('Dados da exploração atualizados com sucesso.');
    } catch (err) {
      setErro(err.message || 'Não foi possível guardar as alterações.');
    } finally {
      setAGuardar(false);
    }
  }

  return (
    <section className="card p-4 mb-5">
      <h2 className="h4 mb-2">Dados da exploração</h2>

      <p className="texto-secundario mb-4">
        Estes dados aparecem na tua página pública de produtor.
      </p>

      {erro && (
        <div className="alert alert-danger" role="alert">
          {erro}
        </div>
      )}

      {sucesso && (
        <div className="alert alert-success" role="status">
          {sucesso}
        </div>
      )}

      <form onSubmit={guardar}>
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label htmlFor="nomeExploracao" className="form-label">
              Nome da exploração
            </label>

            <input
              id="nomeExploracao"
              name="nomeExploracao"
              className="form-control"
              value={campos.nomeExploracao}
              onChange={alterar}
              maxLength={150}
              required
            />
          </div>

          <div className="col-12 col-md-6">
            <label htmlFor="localidade" className="form-label">
              Localidade
            </label>

            <input
              id="localidade"
              name="localidade"
              className="form-control"
              value={campos.localidade}
              onChange={alterar}
              maxLength={100}
              required
            />
          </div>

          <div className="col-12">
            <label htmlFor="descricao" className="form-label">
              Descrição da exploração
            </label>

            <textarea
              id="descricao"
              name="descricao"
              className="form-control"
              rows={4}
              maxLength={1000}
              value={campos.descricao}
              onChange={alterar}
            />

            <div className="form-text">
              Máximo de 1000 caracteres.
            </div>
          </div>

          <div className="col-12">
            <h3 className="h6 mb-2">
              Localização no mapa (opcional)
            </h3>

            <p className="small texto-secundario">
              Se não indicares coordenadas, o mapa utiliza
              a localidade da exploração.
            </p>
          </div>

          <div className="col-12 col-md-6">
            <label htmlFor="latitude" className="form-label">
              Latitude
            </label>

            <input
              id="latitude"
              name="lat"
              type="text"
              inputMode="decimal"
              className="form-control"
              placeholder="Ex.: 41.53"
              value={campos.lat}
              onChange={alterar}
            />
          </div>

          <div className="col-12 col-md-6">
            <label htmlFor="longitude" className="form-label">
              Longitude
            </label>

            <input
              id="longitude"
              name="lng"
              type="text"
              inputMode="decimal"
              className="form-control"
              placeholder="Ex.: -8.62"
              value={campos.lng}
              onChange={alterar}
            />
          </div>

          <div className="col-12">
            <button
              type="submit"
              className="btn btn-success"
              disabled={aGuardar}
            >
              {aGuardar
                ? 'A guardar...'
                : 'Guardar alterações'}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
